#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report = new File;
report.createForWriting("/tmp/pjsr-ui-probe.txt");
let inputs = ["/tmp/slum-ui-r.xisf", "/tmp/slum-ui-b.xisf"];
let output = "/tmp/slum-ui-result.xisf";
function makeFile(path, id, base, binning) {
   if (File.exists(path)) File.remove(path);
   let w = new ImageWindow(128, 128, 1, 32, true, false, "Test" + id);
   w.mainView.beginProcess();
   for (let y = 0; y < 128; ++y)
      for (let x = 0; x < 128; ++x)
         w.mainView.image.setSample(base + ((x * 1973 + y * 9277) % 1000) / 1000000, x, y);
   w.mainView.endProcess();
   w.keywords = [new FITSKeyword("XBINNING", String(binning)),
      new FITSKeyword("YBINNING", String(binning))];
   if (!w.saveAs(path, false, false, true, true)) throw new Error("source save failed");
   w.forceClose();
}
try {
   if (File.exists(output)) File.remove(output);
   makeFile(inputs[0], "R", 0.02, 1);
   makeFile(inputs[1], "B", 0.03, 2);
   let dialog = new SlumDialog;
   report.outTextLn("dialog=" + dialog.windowTitle);
   report.outTextLn("channels=" + Object.keys(dialog.channels).join(","));
   dialog.channels.R.path.text = inputs[0];
   dialog.channels.B.path.text = inputs[1];
   dialog.outputEdit.text = output;
   dialog.analyze("");
   dialog.methodCombo.onItemSelected(2);
   report.outTextLn("reference=" + dialog.session.reference + " groups=" + dialog.groupNames.join(","));
   report.outTextLn("withoutSharesEnabled=" + dialog.saveButton.enabled);
   dialog.groupSliders[0].setValue(70);
   dialog.groupSliders[0].onValueUpdated(70);
   dialog.refreshSummary();
   report.outTextLn("withoutConfirmationsEnabled=" + dialog.saveButton.enabled);
   dialog.prerequisite.checked = true;
   dialog.refreshSummary();
   report.outTextLn("withoutRasterConfirmationEnabled=" + dialog.saveButton.enabled);
   dialog.registration.checked = true;
   dialog.refreshSummary();
   report.outTextLn("saveEnabled=" + dialog.saveButton.enabled);
   let analyzedRows = dialog.session.rows;
   dialog.referenceCombo.onItemSelected(2);
   report.outTextLn("override=" + dialog.session.reference + " shares=" +
      (100 * dialog.shares()["1x1"]) + "," + (100 * dialog.shares()["2x2"]) +
      " reusedRows=" + (dialog.session.rows === analyzedRows));
   dialog.refreshSummary();
   report.outTextLn("afterOverrideEnabled=" + dialog.saveButton.enabled);
   dialog.render().save("/tmp/slum-ui-probe.png");
   dialog.create();
   report.outTextLn("created=" + File.exists(output) + " status=" + dialog.status.text);
   report.outTextLn("resultHasNoise=" + (dialog.report.text.indexOf("Noise nach Normalisierung:")>=0) +
      " resultHasWeights=" + (dialog.report.text.indexOf("Endgewichte:")>=0));
   File.remove(output);
   let originalProgress = dialog.progress;
   dialog.progress = function(stage){
      if(stage === "Eingabe R geladen") this.cancelRequested = true;
      return originalProgress.call(this,stage);
   };
   dialog.analyze("");
   report.outTextLn("cancelled=" + dialog.status.text + " windows=" +
      dialog.session.windows.length + " output=" + File.exists(output));
   dialog.session.close();
} catch (e) { report.outTextLn("ERROR=" + String(e) + " MESSAGE=" + e.message + " STACK=" + e.stack); }
finally {
   for (let i = 0; i < inputs.length; ++i) if (File.exists(inputs[i])) File.remove(inputs[i]);
   if (File.exists(output)) File.remove(output);
}
report.close();
