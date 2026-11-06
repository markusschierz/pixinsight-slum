#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-spfc-run-probe.txt");
let root = "/home/markus/Nextcloud/Documents/_devleopment/pixsinsight-slum/flux-samples/";
let session = new SlumSession;
let output = null;
let original = null;
try {
   original = ImageWindow.open(root + "L_FLUX.xisf")[0];
   let before = original.mainView.image.sample(4000,3000);
   let rows = session.analyze({
      L:{source:"view",viewId:original.mainView.id},
      R:{source:"file",path:root+"R_FLUX.xisf"},
      G:{source:"file",path:root+"G_FLUX.xisf"},
      B:{source:"file",path:root+"B_FLUX.xisf"}
   });
   report.outTextLn("analyzed method="+session.method+" available="+session.spfcAvailable+
      " recommended="+session.recommended+" valid="+rows.every(function(r){return r.spfc.valid}));
   let samples = rows.map(function(r){return r.view.image.sample(4000,3000)});
   let result = session.createView({L:"1x1",R:"1x1",G:"1x1",B:"1x1"},null,true);
   output = View.viewById(result.viewId).window;
   let expected = 0;
   for (let i=0;i<rows.length;++i) {
      let weight=result.weights.filter(function(w){return w.id===rows[i].id})[0].weight;
      expected += samples[i]*rows[i].spfc.scale*weight;
   }
   report.outTextLn("created="+result.viewId+" method="+session.lastRun.method+
      " pixel="+output.mainView.image.sample(4000,3000)+" expected="+expected+
      " delta="+Math.abs(output.mainView.image.sample(4000,3000)-expected)+
      " originalUnchanged="+(original.mainView.image.sample(4000,3000)===before)+
      " weights="+result.weights.map(function(w){return w.id+":"+w.weight}).join(","));
   output.forceClose();
   output = null;
   let path="/tmp/pjsr-spfc-rgb-output.xisf";
   if (File.exists(path)) File.remove(path);
   rows=session.analyze({
      R:{source:"file",path:root+"R_FLUX.xisf"},
      G:{source:"file",path:root+"G_FLUX.xisf"},
      B:{source:"file",path:root+"B_FLUX.xisf"}
   });
   let rgbSamples=rows.map(function(r){return r.view.image.sample(4000,3000)});
   let rgbWeights=session.create(path,{R:"1x1",G:"1x1",B:"1x1"},null,true);
   let file=ImageWindow.open(path)[0];
   try {
      let rgbExpected=0;
      for(let i=0;i<rows.length;++i)
         rgbExpected+=rgbSamples[i]*rows[i].spfc.scale*rgbWeights[i].weight;
      report.outTextLn("rgbFile="+File.exists(path)+" method="+session.lastRun.method+
         " recommended="+session.lastRun.recommended+
         " delta="+Math.abs(file.mainView.image.sample(4000,3000)-rgbExpected));
   } finally {file.forceClose();File.remove(path);}
} catch(e) {report.outTextLn("ERROR="+e+" STACK="+e.stack);}
finally {
   session.close();
   if (output && !output.isNull) output.forceClose();
   if (original && !original.isNull) original.forceClose();
   report.close();
}
