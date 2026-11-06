#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-view-probe.txt");
let filePath = "/tmp/slum-view-source.xisf";
let output = "/tmp/slum-view-output.xisf";
let originals = [];
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
   if (File.exists(filePath)) File.remove(filePath);
   if (File.exists(output)) File.remove(output);
   let l = makeView("SourceL", 0.02);
   let r = makeView("SourceR", 0.03);
   l.saveAs(filePath, false, false, true, true);
   let lBefore = l.mainView.image.sample(40, 60);
   let rBefore = r.mainView.image.sample(40, 60);
   let lModified = l.isModified, rModified = r.isModified;
   let rows = session.analyze({ L: { source: "file", path: filePath },
      R: { source: "view", viewId: r.mainView.id } });
   report.outTextLn("mixedSources=" + rows.map(function(row){return row.sourceLabel}).join(";"));
   let weights = session.weights({L:"1x1",R:"1x1"},null);
   let expected = weights[0].weight * rows[0].view.image.sample(40,60) +
      weights[1].weight * rows[1].view.image.sample(40,60);
   session.create(output,{L:"1x1",R:"1x1"},null,true);
   let result = ImageWindow.open(output)[0];
   report.outTextLn("pixelDifference=" + Math.abs(expected-result.mainView.image.sample(40,60)));
   result.forceClose();
   report.outTextLn("originalsOpen=" + (!l.isNull && !r.isNull) +
      " pixelsUnchanged=" + (l.mainView.image.sample(40,60)===lBefore &&
      r.mainView.image.sample(40,60)===rBefore) +
      " modifiedUnchanged=" + (l.isModified===lModified && r.isModified===rModified));
   rows = session.analyze({ L:{source:"view",viewId:l.mainView.id},
      R:{source:"view",viewId:r.mainView.id} });
   report.outTextLn("viewOnly="+rows.map(function(row){return row.sourceLabel}).join(";"));
   session.close();
   try { session.analyze({ L:{source:"view",viewId:l.mainView.id},
      R:{source:"file",path:filePath} }); }
   catch(e){report.outTextLn("sameFileView="+String(e));}
   try { session.analyze({ L:{source:"view",viewId:"SLUMMissingView"},
      R:{source:"file",path:filePath} }); }
   catch(e){report.outTextLn("missingView="+String(e));}
   report.outTextLn("afterErrorOriginalsOpen="+(!l.isNull && !r.isNull));
} catch(e) { report.outTextLn("ERROR="+String(e)+" STACK="+e.stack); }
finally {
   session.close();
   for(let i=0;i<originals.length;++i) if(originals[i] && !originals[i].isNull) originals[i].forceClose();
   if(File.exists(filePath)) File.remove(filePath);
   if(File.exists(output)) File.remove(output);
   report.close();
}
