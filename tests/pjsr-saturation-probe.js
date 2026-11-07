// Regressionsprobe für die Sternrand-Korrektur. Läuft in echtem PixInsight:
//   SLUM_ROOT=<Repo> SLUM_DATA=<Ordner mit L/R/G/B_FLUX.xisf> SLUM_OUT=<Berichtsdatei> \
//   PixInsight --automation-mode --run=<Repo>/tests/pjsr-saturation-probe.js --force-exit
#engine v8
let root = getEnvironmentVariable("SLUM_ROOT");
let data = getEnvironmentVariable("SLUM_DATA");
let report = new File;
report.createForWriting(getEnvironmentVariable("SLUM_OUT"));
let failures = 0;
function check(name, ok, detail) {
   if (!ok) ++failures;
   report.outTextLn((ok ? "PASS " : "FAIL ") + name + (detail ? "  " + detail : ""));
}
try {
   let sources = ["slum-core.js", "slum-stats.js", "slum-spfc.js", "slum-engine.js"];
   for (let i = 0; i < sources.length; ++i)
      eval(File.readTextFile(root + "/src/" + sources[i]));
   function run(fix) {
      let s = new SlumSession, inputs = {};
      ["L", "R", "G", "B"].forEach(function (c) {
         inputs[c] = { source: "file", path: data + "/" + c + "_FLUX.xisf" };
      });
      s.analyze(inputs);
      s.setLuminanceFraction(0.66);
      s.setSaturationCorrection(fix);
      let sampling = { L: "1x1", R: "1x1", G: "1x1", B: "1x1" };
      let result = s.createView(sampling, null);
      return { id: result.viewId, run: s.lastRun };
   }
   let off = run(false), on = run(true);
   let a = View.viewById(off.id).image, b = View.viewById(on.id).image;
   check("Sättigung in allen Kanälen erkannt", on.run.saturation.channels.length === 4,
      on.run.saturation.channels.join(","));
   check("Korrektur angewandt", on.run.saturation.applied === true);
   check("Aus: Korrektur nicht angewandt", off.run.saturation.applied === false);
   // Fern von Sternen: Differenz exakt 0 (Zufallspunkte, ungesättigter Hintergrund)
   let maxFar = 0, changed = 0, total = 4000;
   for (let i = 0; i < total; ++i) {
      let x = 50 + ((i * 7919) % (a.width - 100)), y = 50 + ((i * 104729) % (a.height - 100));
      let d = Math.abs(a.sample(x, y) - b.sample(x, y));
      if (d > 0) ++changed;
      if (d > maxFar) maxFar = d;
   }
   check("Hintergrund unverändert (Stichprobe 4000 Pixel)", changed < total * 0.01,
      "geändert " + changed + ", max Diff " + maxFar);
   let stars = [[4432, 5548], [2572, 1236], [7300, 1304]];
   stars.forEach(function (c) {
      let minRatio = 1e9, monotone = true, last = 1e9;
      for (let r = 0; r <= 40; r += 2) {
         let sum = 0, n = 0;
         for (let d = 0; d < 8; ++d) {
            let x = Math.round(c[0] + r * Math.cos(d * Math.PI / 4));
            let y = Math.round(c[1] + r * Math.sin(d * Math.PI / 4));
            sum += b.sample(x, y); ++n;
         }
         let v = sum / n;
         if (r >= 4 && v > last * 1.02) monotone = false;
         last = v;
      }
      check("Profil " + c + " fällt vom Rand nach außen monoton", monotone);
      let peakOff = 0, peakOn = 0;
      for (let y = -6; y <= 6; ++y) for (let x = -6; x <= 6; ++x) {
         peakOff = Math.max(peakOff, a.sample(c[0] + x, c[1] + y));
         peakOn = Math.max(peakOn, b.sample(c[0] + x, c[1] + y));
      }
      check("Stern " + c + ": Korrektur senkt nie unter 29-%-Mischung (≥ 0,6 × Peak aus)",
         peakOn >= 0.6 * peakOff && peakOn <= peakOff,
         "peak aus " + peakOff.toFixed(3) + " ein " + peakOn.toFixed(3));
   });
   report.outTextLn("DONE failures=" + failures);
} catch (e) {
   ++failures;
   report.outTextLn("ERROR=" + e + " " + e.stack);
}
report.close();
