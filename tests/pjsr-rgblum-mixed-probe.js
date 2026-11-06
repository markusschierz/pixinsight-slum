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
   let shares={"1x1":0.4,"2x2":0.6};
   session.validateMix(sampling,shares);
   session.prepare();
   let byId={};
   for(let row of session.rows)byId[row.id]=row;
   let gVariance=1/Math.pow(byId.G.noise,2);
   let bVariance=1/Math.pow(byId.B.noise,2);
   let rgbExpected=0.4*byId.R.view.image.sample(40,60)+
      0.6*(gVariance*byId.G.view.image.sample(40,60)+
         bVariance*byId.B.view.image.sample(40,60))/(gVariance+bVariance);
   let expected=0.7*byId.L.view.image.sample(40,60)+0.3*rgbExpected;
   let result=session.createView(sampling,shares,true);
   output=View.viewById(result.viewId).window;
   let w=result.weights;
   let delta=Math.abs(output.mainView.image.sample(40,60)-expected);
   report.outTextLn("L="+w[0].weight+" RGB="+
      w.slice(1).reduce(function(s,x){return s+x.weight},0)+
      " R="+w[1].weight+" GB="+(w[2].weight+w[3].weight)+
      " pixelDifference="+delta+
      " originalUnchanged="+(l.mainView.image.sample(40,60)===original)+
      " method="+session.lastRun.method);
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
      dialog.shareRows[0].edit.text="40";
      dialog.shareRows[1].edit.text="60";
      dialog.prerequisite.checked=true;
      dialog.registration.checked=true;
      dialog.refreshSummary();
      report.outTextLn("groups="+dialog.groupNames.join(",")+
         " label="+dialog.shareLabel.text+
         " ready="+dialog.saveButton.enabled+
         " groupReport="+(dialog.report.text.indexOf("RGBLUM-Gruppe 1x1: 40.00%")>=0)+
         " mixReport="+(dialog.report.text.indexOf("SLUM = 70% L + 30% RGBLUM")>=0));
      dialog.render().save("/tmp/pjsr-rgblum-mixed-probe.png");
      dialog.session.close();
   } finally {dialog.session.close();}
} catch(e){report.outTextLn("ERROR="+e+" STACK="+e.stack);}
finally {
   session.close();
   if(output&&!output.isNull)output.forceClose();
   for(let w of windows)if(w&&!w.isNull)w.forceClose();
   report.close();
}
