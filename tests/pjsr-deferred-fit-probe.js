#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report = new File;
report.createForWriting("/tmp/pjsr-deferred-fit-probe.txt");
let sources = [];
let output = null;
let session = new SlumSession;
function makeSource(id, base) {
   let w = new ImageWindow(128,128,1,32,true,false,id);
   w.mainView.beginProcess();
   for (let y=0;y<128;++y) for (let x=0;x<128;++x)
      w.mainView.image.setSample(base+((x*1973+y*9277)%1000)/1000000,x,y);
   w.mainView.endProcess();
   w.keywords=[new FITSKeyword("XBINNING","1"),new FITSKeyword("YBINNING","1")];
   sources.push(w);
   return w;
}
try {
   let l=makeSource("DeferredL",0.02),r=makeSource("DeferredR",0.03);
   let lBefore=l.mainView.image.sample(40,60),rBefore=r.mainView.image.sample(40,60);
   let config={L:{source:"view",viewId:l.mainView.id},
      R:{source:"view",viewId:r.mainView.id}};
   let rows=session.analyze(config);
   report.outTextLn("afterAnalyze reference="+session.reference+
      " noisePending="+rows.every(function(row){return row.noise === undefined})+
      " unfitR="+(rows[1].view.image.sample(40,60)===r.mainView.image.sample(40,60)));
   session.selectReference("R");
   report.outTextLn("afterSwitch reference="+session.reference+
      " sameRows="+(session.rows===rows)+
      " noisePending="+rows.every(function(row){return row.noise === undefined}));
   let result=session.createView({L:"1x1",R:"1x1"},null,true);
   output=View.viewById(result.viewId).window;
   report.outTextLn("created="+(!output.isNull)+" reference="+session.lastRun.reference+
      " weights="+result.weights.map(function(w){return w.id+":"+w.weight}).join(",")+
      " count="+session.lastRun.rows.length);
   report.outTextLn("sourcesUnchanged="+(l.mainView.image.sample(40,60)===lBefore &&
      r.mainView.image.sample(40,60)===rBefore && !l.isNull && !r.isNull));
   let dialog=new SlumDialog;
   dialog.channels.L.source.currentItem=1;
   dialog.channels.L.viewList.currentView=l.mainView;
   dialog.channels.R.source.currentItem=1;
   dialog.channels.R.viewList.currentView=r.mainView;
   dialog.outputMode.currentItem=1;
   dialog.analyze("");
   let firstRows=dialog.session.rows;
   dialog.referenceCombo.onItemSelected(2);
   report.outTextLn("uiSwitch reference="+dialog.session.reference+
      " reusedRows="+(dialog.session.rows===firstRows)+
      " summaryPending="+(dialog.report.text.indexOf("bei der Ausgabe")>=0));
   dialog.session.close();
} catch(e) {report.outTextLn("ERROR="+String(e)+" STACK="+e.stack);}
finally {
   session.close();
   if(output && !output.isNull) output.forceClose();
   for(let i=0;i<sources.length;++i)if(sources[i]&&!sources[i].isNull)sources[i].forceClose();
   report.close();
}
