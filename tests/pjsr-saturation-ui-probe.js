#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
// SLUM_DATA: Ordner mit L/R/G/B_FLUX.xisf, SLUM_OUT: Ausgabe-Präfix (.txt und .png)
let data = getEnvironmentVariable("SLUM_DATA") + "/";
let out = getEnvironmentVariable("SLUM_OUT");
let report = new File;
report.createForWriting(out + ".txt");
let d = new SlumDialog;
try {
   report.outTextLn("vorher sichtbar=" + d.saturationBox.visible + " checked=" + d.saturationBox.checked);
   ["L", "R", "G", "B"].forEach(function (c) { d.channels[c].path.text = data + c + "_FLUX.xisf"; });
   d.outputMode.currentItem = 1;
   d.outputModeChanged();
   d.analyze("");
   d.refreshSummary();
   report.outTextLn("nach Analyse sichtbar=" + d.saturationBox.visible + " enabled=" + d.saturationBox.enabled);
   d.saturationBox.checked = true;
   d.saturationBox.onClick(true);
   report.outTextLn("session.saturationFix=" + d.session.saturationFix);
   d.render().save(out + ".png");
} catch (e) { report.outTextLn("ERROR=" + e + " " + e.stack); }
report.close();
