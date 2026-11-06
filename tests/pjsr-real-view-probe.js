#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-real-view-probe.txt");
let root = "/home/markus/Nextcloud/Documents/_devleopment/pixsinsight-slum/sample-data/";
let output = "/tmp/slum-real-view-probe.xisf";
let original = null;
let session = new SlumSession;
try {
   if (File.exists(output)) File.remove(output);
   original = ImageWindow.open(root + "R.fit")[0];
   let sample = original.mainView.image.sample(4000,3000);
   let modified = original.isModified;
   let rows = session.analyze({ L:{source:"file",path:root+"L.fit"},
      R:{source:"view",viewId:original.mainView.id} });
   session.selectMethod("linearFit");
   report.outTextLn("sources="+rows.map(function(r){return r.sourceLabel}).join(";"));
   report.outTextLn("reference="+session.recommended);
   session.prepare();
   let weights = session.weights({L:"1x1",R:"1x1"},null);
   let expected = weights[0].weight*rows[0].view.image.sample(4000,3000)+
      weights[1].weight*rows[1].view.image.sample(4000,3000);
   session.create(output,{L:"1x1",R:"1x1"},null,true);
   let result = ImageWindow.open(output)[0];
   report.outTextLn("output="+result.mainView.image.width+"x"+
      result.mainView.image.height+":"+result.bitsPerSample+":"+result.isFloatSample+
      " pixelDifference="+Math.abs(expected-result.mainView.image.sample(4000,3000)));
   result.forceClose();
   report.outTextLn("originalOpen="+(!original.isNull)+
      " pixelUnchanged="+(original.mainView.image.sample(4000,3000)===sample)+
      " modifiedUnchanged="+(original.isModified===modified));
} catch(e) { report.outTextLn("ERROR="+String(e)+" STACK="+e.stack); }
finally {
   session.close();
   if (original && !original.isNull) original.forceClose();
   if (File.exists(output)) File.remove(output);
   report.close();
}
