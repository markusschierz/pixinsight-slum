#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report = new File;
report.createForWriting("/tmp/pjsr-rgblum-mixed-probe.txt");
let windows = [], output = null;
function source(id, base, bin) {
   let w = new ImageWindow(128,128,1,32,true,false,"RGBLUM"+id);
   w.mainView.beginProcess();
   for(let y=0;y<128;++y)for(let x=0;x<128;++x)
      w.mainView.image.setSample(base+((x*1973+y*9277)%1000)/1000000,x,y);
   w.mainView.endProcess();
   w.keywords=[new FITSKeyword("XBINNING",String(bin)),
      new FITSKeyword("YBINNING",String(bin))];
   windows.push(w);
   return w;
}
let session=new SlumSession;
try {
   let l=source("L",0.02,1), r=source("R",0.03,1),
      g=source("G",0.04,2), b=source("B",0.05,2);
   let original=l.mainView.image.sample(40,60);
   let config={};
   for(let w of windows)config[w.mainView.id.slice(-1)]={source:"view",viewId:w.mainView.id};
   let rows=session.analyze(config);
   session.selectMethod("linearFit");
   session.setLuminanceFraction(0.7);
   let sampling={L:"1x1",R:"1x1",G:"2x2",B:"2x2"};
   session.validateMix(sampling,null);
   session.prepare();
   let byId={};
   for(let row of session.rows)byId[row.id]=row;
   let inverse={};
   for(let id of ["R","G","B"])inverse[id]=1/Math.pow(byId[id].noise,2);
   let total=inverse.R+inverse.G+inverse.B;
   let rgbExpected=["R","G","B"].reduce(function(sum,id){
      return sum+inverse[id]/total*byId[id].view.image.sample(40,60);
   },0);
   let expected=0.7*byId.L.view.image.sample(40,60)+0.3*rgbExpected;
   let result=session.createView(sampling,null,true);
   output=View.viewById(result.viewId).window;
   let w=result.weights;
   let delta=Math.abs(output.mainView.image.sample(40,60)-expected);
   report.outTextLn("L="+w[0].weight+" RGB="+
      w.slice(1).reduce(function(s,x){return s+x.weight},0)+
      " autoRGB="+w.slice(1).map(function(item){return item.id+":"+item.weight}).join(",")+
      " pixelDifference="+delta+
      " originalUnchanged="+(l.mainView.image.sample(40,60)===original)+
      " method="+session.lastRun.method+" mode="+session.lastRun.weightMode);
   let manualSession=new SlumSession;
   let manualOutput=null;
   try {
      manualSession.analyze(config);
      manualSession.selectMethod("linearFit");
      manualSession.setLuminanceFraction(0.7);
      manualSession.prepare();
      let manualRows={};
      for(let row of manualSession.rows)manualRows[row.id]=row;
      let expectedManual=0.7*manualRows.L.view.image.sample(40,60)+
         0.3*(0.4*manualRows.R.view.image.sample(40,60)+
         0.35*manualRows.G.view.image.sample(40,60)+
         0.25*manualRows.B.view.image.sample(40,60));
      let manualResult=manualSession.createView({L:"1x1",R:"1x1",G:"2x2",B:"3x3"},
         {R:0.4,G:0.35,B:0.25},true);
      manualOutput=View.viewById(manualResult.viewId).window;
      report.outTextLn("manualWeights="+manualResult.weights.map(function(w){
         return w.id+":"+w.weight;
      }).join(",")+" pixelDifference="+
         Math.abs(expectedManual-manualOutput.mainView.image.sample(40,60))+
         " mode="+manualSession.lastRun.weightMode+
         " originalUnchanged="+(l.mainView.image.sample(40,60)===original));
   } finally {
      manualSession.close();
      if(manualOutput&&!manualOutput.isNull)manualOutput.forceClose();
   }
   let dialog=new SlumDialog;
   try {
      for(let w of windows){
         let id=w.mainView.id.slice(-1);
         dialog.channels[id].source.currentItem=1;
         dialog.channels[id].source.onItemSelected(1);
         dialog.channels[id].viewList.currentView=w.mainView;
      }
      dialog.outputMode.currentItem=1;
      dialog.outputModeChanged();
      dialog.analyze("");
      dialog.methodCombo.currentItem=2;
      dialog.methodCombo.onItemSelected(2);
      let analyzedRows=dialog.session.rows;
      dialog.prerequisite.checked=true;
      dialog.registration.checked=true;
      dialog.refreshSummary();
      report.outTextLn("autoMode="+(dialog.rgbMode.currentItem===0)+
         " ready="+dialog.saveButton.enabled+
         " sameAnalysis="+(dialog.session.rows===analyzedRows)+
         " noiseDeferred="+analyzedRows.every(function(row){return row.noise===undefined})+
         " mixReport="+(dialog.report.text.indexOf("SLUM = 70% L + 30% RGBLUM")>=0));
      dialog.render().save("/tmp/pjsr-rgblum-mixed-probe.png");
      dialog.channels.B.sampling.text="3x3";
      report.outTextLn("bin3Hint="+(dialog.rgbHint.text.indexOf("Heuristik")>=0)+
         " autoReady="+dialog.saveButton.enabled+
         " sameAnalysis="+(dialog.session.rows===analyzedRows));
      dialog.rgbMode.currentItem=1;
      dialog.rgbMode.onItemSelected(1);
      report.outTextLn("missingManualBlocked="+(!dialog.saveButton.enabled)+
         " reason="+dialog.validation.text);
      dialog.manualFields.R.edit.text="40";
      dialog.manualFields.G.edit.text="35";
      dialog.refreshSummary();
      let manual=dialog.manualWeights();
      report.outTextLn("manual="+[manual.R,manual.G,manual.B].join(",")+
         " ready="+dialog.saveButton.enabled+
         " computed="+dialog.manualFields.B.computed.text+
         " hint="+dialog.lShareHint.text);
      dialog.render().save("/tmp/pjsr-rgblum-three-groups.png");
      dialog.manualFields.R.edit.text="80";
      dialog.manualFields.G.edit.text="40";
      dialog.refreshSummary();
      report.outTextLn("invalidBlocked="+(!dialog.saveButton.enabled)+
         " reason="+dialog.validation.text);
      dialog.rgbMode.currentItem=0;
      dialog.rgbMode.onItemSelected(0);
      report.outTextLn("restoredAuto="+dialog.saveButton.enabled+
         " sameAnalysis="+(dialog.session.rows===analyzedRows));
      dialog.session.close();
   } finally {dialog.session.close();}
} catch(e){report.outTextLn("ERROR="+e+" STACK="+e.stack);}
finally {
   session.close();
   if(output&&!output.isNull)output.forceClose();
   for(let w of windows)if(w&&!w.isNull)w.forceClose();
   report.close();
}
