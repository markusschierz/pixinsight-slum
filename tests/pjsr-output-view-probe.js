#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report = new File;
report.createForWriting("/tmp/pjsr-output-view-probe.txt");
let unexpectedFile = "/tmp/slum-output-view-must-not-exist.xisf";
let originals = [];
let resultWindow = null;
let dialogWindow = null;
let session = new SlumSession;
function makeView(id, base) {
   let window = new ImageWindow(128, 128, 1, 32, true, false, id);
   window.mainView.beginProcess();
   for (let y = 0; y < 128; ++y)
      for (let x = 0; x < 128; ++x)
         window.mainView.image.setSample(base + ((x * 1973 + y * 9277) % 1000) / 1000000, x, y);
   window.mainView.endProcess();
   window.keywords = [new FITSKeyword("XBINNING", "1"), new FITSKeyword("YBINNING", "1")];
   originals.push(window);
   return window;
}
try {
   if (File.exists(unexpectedFile)) File.remove(unexpectedFile);
   let l = makeView("OutputSourceL", 0.02);
   let r = makeView("OutputSourceR", 0.03);
   let lBefore = l.mainView.image.sample(40, 60);
   let rBefore = r.mainView.image.sample(40, 60);
   let lModified = l.isModified, rModified = r.isModified;
   let config = {L:{source:"view",viewId:l.mainView.id},
      R:{source:"view",viewId:r.mainView.id}};
   let rows = session.analyze(config);
   session.prepare();
   let weights = session.weights({L:"1x1",R:"1x1"},null);
   let expected = weights[0].weight * rows[0].view.image.sample(40,60) +
      weights[1].weight * rows[1].view.image.sample(40,60);
   let result = session.createView({L:"1x1",R:"1x1"},null,true);
   let resultView = View.viewById(result.viewId);
   resultWindow = resultView.window;
   report.outTextLn("viewId=" + result.viewId + " stillOpen=" +
      (!resultView.isNull && !resultWindow.isNull));
   report.outTextLn("format=" + resultWindow.mainView.image.numberOfChannels +
      "x" + resultWindow.bitsPerSample + " float=" + resultWindow.isFloatSample);
   report.outTextLn("pixelDifference=" +
      Math.abs(expected - resultWindow.mainView.image.sample(40,60)));
   report.outTextLn("noFile=" + !File.exists(unexpectedFile) +
      " workWindows=" + session.windows.length);
   report.outTextLn("originalsUnchanged=" + (l.mainView.image.sample(40,60)===lBefore &&
      r.mainView.image.sample(40,60)===rBefore &&
      l.isModified===lModified && r.isModified===rModified));

   let dialog = new SlumDialog;
   dialog.channels.L.source.currentItem = 1;
   dialog.channels.L.viewList.getMainViews();
   dialog.channels.L.viewList.currentView = l.mainView;
   dialog.channels.R.source.currentItem = 1;
   dialog.channels.R.viewList.getMainViews();
   dialog.channels.R.viewList.currentView = r.mainView;
   dialog.analyze("");
   dialog.outputEdit.text = unexpectedFile;
   dialog.outputMode.currentItem = 1;
   dialog.outputModeChanged();
   dialog.prerequisite.checked = true;
   dialog.registration.checked = true;
   dialog.refreshSummary();
   report.outTextLn("viewModeEnabled=" + dialog.saveButton.enabled +
      " pathHidden=" + !dialog.outputEdit.visible);
   dialog.render().save("/tmp/slum-output-view-dialog.png");
   dialog.create();
   let dialogViewId = dialog.lastOutputViewId;
   report.outTextLn("dialogView=" + dialogViewId + " status=" + dialog.status.text +
      " noFile=" + !File.exists(unexpectedFile));
   dialogWindow = View.viewById(dialogViewId).window;
   dialog.session.close();
   report.outTextLn("afterDialogClose=" + !dialogWindow.isNull +
      " uniqueName=" + (dialogViewId === "SLUM_1"));
   dialogWindow.forceClose();
   dialogWindow = null;

   session.analyze(config);
   try {
      session.createView({L:"1x1",R:"1x1"},null,true,function(stage) {
         if (stage === "SLUM-Ansicht wird ausgegeben") throw new Error("Abbruchprobe");
      });
      report.outTextLn("cancelRejected=false");
   } catch(e) {
      report.outTextLn("cancelRejected=" + (e.message === "Abbruchprobe") +
         " noCancelledView=" + !View.viewById("SLUM_1") +
         " workWindows=" + session.windows.length);
   }
} catch(e) { report.outTextLn("ERROR=" + String(e) + " STACK=" + e.stack); }
finally {
   session.close();
   if (dialogWindow && !dialogWindow.isNull) dialogWindow.forceClose();
   if (resultWindow && !resultWindow.isNull) resultWindow.forceClose();
   for(let i=0;i<originals.length;++i) if(originals[i] && !originals[i].isNull) originals[i].forceClose();
   if(File.exists(unexpectedFile)) File.remove(unexpectedFile);
   report.close();
}
