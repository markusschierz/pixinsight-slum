// Run with PixInsight --automation-mode --run=<absolute path> --force-exit.
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
let probe = new File;
probe.createForWriting("/tmp/pjsr-probe.txt");
probe.outTextLn("PixInsight " + CoreApplication.versionMajor + "." +
   CoreApplication.versionMinor + "." + CoreApplication.versionRelease +
   " revision " + CoreApplication.versionRevision);
probe.outTextLn("ImageWindow=" + typeof ImageWindow +
   " LinearFit=" + typeof LinearFit +
   " PixelMath=" + typeof PixelMath +
   " Dialog=" + typeof Dialog);
probe.outTextLn("reference=" + chooseReference([
   { id: "L", median: 0.02 }, { id: "B", median: 0.01 }
]));
probe.outTextLn("weights=" + computeWeights([
   { id: "L", noise: 1, group: "bin1" },
   { id: "B", noise: 2, group: "bin1" }
]).map(function (row) { return row.weight; }).join(","));
let window = new ImageWindow(128, 128, 1, 32, true, false, "SLUMProbe");
try {
   let view = window.mainView;
   view.beginProcess();
   for (let y = 0; y < 128; ++y)
      for (let x = 0; x < 128; ++x)
         view.image.setSample(0.02 + ((x * 1973 + y * 9277) % 1000) / 1000000, x, y);
   view.endProcess();
   probe.outTextLn("median=" + sampleMedians([view.image, view.image])[0]);
   let noise = estimateNoise(view.image);
   probe.outTextLn("noise=" + noise.noise + " count=" + noise.countPercent);
} catch (error) {
   probe.outTextLn("ERROR=" + error.message + " STACK=" + error.stack);
} finally {
   window.purge();
   window.close();
}
probe.close();
