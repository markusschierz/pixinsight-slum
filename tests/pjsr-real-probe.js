#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-real-probe.txt");
let root = "/home/markus/Nextcloud/Documents/_devleopment/pixsinsight-slum/sample-data/";
let output = "/tmp/slum-real-probe.xisf";
let session = new SlumSession;
let preexisting = null;
try {
   if (File.exists(output)) File.remove(output);
   preexisting = ImageWindow.open(root+"R.fit")[0];
   let originalSample = preexisting.mainView.image.sample(4000,3000);
   let originalModified = preexisting.isModified;
   let analysisStart = Date.now();
   let rows = session.analyze({
      L:{path:root+"L.fit"}, R:{path:root+"R.fit"},
      G:{path:root+"G.fit"}, B:{path:root+"B.fit"}
   });
   report.outTextLn("analysisSeconds=" + (Date.now()-analysisStart)/1000 +
      " fitDeferred=" + rows.every(function(r){return r.noise===undefined}));
   report.outTextLn("reference=" + session.recommended + " certain=" + session.registrationCertain);
   let switchStart=Date.now();
   session.selectReference("R");
   session.selectReference(session.recommended);
   report.outTextLn("referenceSwitchMilliseconds=" + (Date.now()-switchStart));
   for (let i = 0; i < rows.length; ++i)
      report.outTextLn(rows[i].id + " median=" + rows[i].median +
         " sampling=" + rows[i].sampling);
   let expected = NaN;
   let outputStart = Date.now();
   let weights = session.create(output,{L:"1x1",R:"1x1",G:"1x1",B:"1x1"},null,true,
      function(stage) {
         if (stage === "SLUM wird berechnet") {
            let expectedWeights = session.weights({L:"1x1",R:"1x1",G:"1x1",B:"1x1"},null);
            expected = expectedWeights.reduce(function(sum,w){
               let row=rows.filter(function(r){return r.id===w.id})[0];
               return sum+w.weight*row.view.image.sample(4000,3000);
            },0);
         }
      });
   report.outTextLn("outputSeconds=" + (Date.now()-outputStart)/1000);
   for (let j=0;j<session.lastRun.rows.length;++j) {
      let row=session.lastRun.rows[j];
      report.outTextLn(row.id+" noise="+row.noise+" count="+row.countPercent);
   }
   report.outTextLn("weights=" + weights.map(function(w){return w.id+":"+w.weight}).join(","));
   let result = ImageWindow.open(output)[0];
   report.outTextLn("output=" + result.mainView.image.width + "x" + result.mainView.image.height +
      " channels=" + result.mainView.image.numberOfChannels + " bits=" + result.bitsPerSample +
      " float=" + result.isFloatSample);
   report.outTextLn("pixelExpected=" + expected + " actual=" +
      result.mainView.image.sample(4000,3000));
   result.forceClose();
   File.remove(output);
   rows = session.analyze({ R:{path:root+"R.fit"},
      G:{path:root+"G.fit"}, B:{path:root+"B.fit"} }, "R");
   report.outTextLn("RGB recommended=" + session.recommended + " actual=" + session.reference);
   let rgbWeights = session.create(output,{R:"1x1",G:"1x1",B:"1x1"},null,true);
   report.outTextLn("RGB weights=" + rgbWeights.map(function(w){return w.id+":"+w.weight}).join(","));
   let rgb = ImageWindow.open(output)[0];
   report.outTextLn("RGB output=" + rgb.mainView.image.numberOfChannels + ":" +
      rgb.bitsPerSample + ":" + rgb.isFloatSample);
   rgb.forceClose();
   report.outTextLn("openOriginal=" + (!preexisting.isNull) +
      " pixelUnchanged=" + (preexisting.mainView.image.sample(4000,3000) === originalSample) +
      " modifiedUnchanged=" + (preexisting.isModified === originalModified));
} catch (e) { report.outTextLn("ERROR=" + String(e) + " STACK=" + e.stack); }
finally {
   session.close();
   if (preexisting && !preexisting.isNull) preexisting.forceClose();
   if (File.exists(output)) File.remove(output);
   report.close();
}
