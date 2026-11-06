#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-engine-probe.txt");
let paths = ["/tmp/slum-test-r.xisf", "/tmp/slum-test-b.xisf"];
let output = "/tmp/slum-test-output.xisf";
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
   makeFile(paths[0], "R", 0.02, 1);
   makeFile(paths[1], "B", 0.03, 2);
   let session = new SlumSession;
   let rows = session.analyze({R:{path:paths[0]},B:{path:paths[1]}});
   report.outTextLn("reference=" + session.recommended + " actual=" + session.reference);
   report.outTextLn("rows=" + rows.map(function(r){return r.id+":"+r.median+":"+r.noise+":"+r.sampling}).join(";"));
   try { session.validateMix({R:"",B:"2x2"},{"1x1":0.7,"2x2":0.3}); }
   catch(e) { report.outTextLn("missingSampling=" + String(e)); }
   try { session.validateMix({R:"1x1",B:"2x2"},{"1x1":0.7,"2x2":0.2}); }
   catch(e) { report.outTextLn("badShares=" + String(e)); }
   try { session.create(output,{R:"1x1",B:"2x2"},{"1x1":0.7,"2x2":0.3},false); }
   catch(e) { report.outTextLn("unconfirmedRaster=" + String(e)); }
   try { session.create(paths[0],{R:"1x1",B:"2x2"},{"1x1":0.7,"2x2":0.3},true); }
   catch(e) { report.outTextLn("existingOutput=" + String(e)); }
   session.prepare();
   let expected = 0.7 * rows[0].view.image.sample(40,60) +
      0.3 * rows[1].view.image.sample(40,60);
   let weights = session.create(output,{R:"1x1",B:"2x2"},{"1x1":0.7,"2x2":0.3},true);
   report.outTextLn("weights=" + weights.map(function(r){return r.weight}).join(","));
   let result = ImageWindow.open(output)[0];
   report.outTextLn("output=" + result.mainView.image.numberOfChannels + ":" + result.bitsPerSample + ":" + result.isFloatSample);
   report.outTextLn("pixelDifference=" + Math.abs(expected-result.mainView.image.sample(40,60)));
   result.forceClose();
   File.remove(output);
   try { session.analyze({R:{path:paths[0]},B:{path:paths[1]}},"",function(stage){
      if (stage === "Eingabe R geladen") throw new Error("test abort");
   }); } catch(e) { report.outTextLn("analysisAbort="+String(e)+" windows="+session.windows.length); }
   session.analyze({R:{path:paths[0]},B:{path:paths[1]}});
   try { session.create(output,{R:"1x1",B:"2x2"},{"1x1":0.7,"2x2":0.3},true,
      function(stage){if(stage === "Temporäre XISF gespeichert") throw new Error("test abort");}); }
   catch(e){report.outTextLn("saveAbort="+String(e)+" output="+File.exists(output)+
      " partial="+File.exists("/tmp/slum-test-output.slum-partial.xisf")+
      " windows="+session.windows.length);}
} catch (e) { report.outTextLn("ERROR=" + e.message + " STACK=" + e.stack); }
finally {
   for (let i = 0; i < paths.length; ++i) if (File.exists(paths[i])) File.remove(paths[i]);
   if (File.exists(output)) File.remove(output);
   report.close();
}
