#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report = new File;
report.createForWriting("/tmp/pjsr-view-ui-probe.txt");
let sourcePath = "/tmp/slum-view-ui-l.xisf";
let outputPath = "/tmp/slum-view-ui-output.xisf";
let windows = [];
function makeView(id, base, binning) {
   let window = new ImageWindow(128,128,1,32,true,false,id);
   window.mainView.beginProcess();
   for(let y=0;y<128;++y)for(let x=0;x<128;++x)
      window.mainView.image.setSample(base+((x*1973+y*9277)%1000)/1000000,x,y);
   window.mainView.endProcess();
   window.keywords=[new FITSKeyword("XBINNING",String(binning)),
      new FITSKeyword("YBINNING",String(binning))];
   windows.push(window);
   return window;
}
try {
   if(File.exists(sourcePath))File.remove(sourcePath);
   if(File.exists(outputPath))File.remove(outputPath);
   let l=makeView("ViewUIL",0.02,1),r=makeView("ViewUIR",0.03,2);
   let alternate=makeView("ViewUIAlternate",0.031,2);
   l.saveAs(sourcePath,false,false,true,true);
   let original=r.mainView.image.sample(40,60), modified=r.isModified;
   let dialog=new SlumDialog;
   dialog.channels.L.path.text=sourcePath;
   dialog.channels.R.source.currentItem=1;
   dialog.channels.R.source.onItemSelected(1);
   dialog.channels.R.viewList.currentView=r.mainView;
   dialog.outputEdit.text=outputPath;
   report.outTextLn("config="+JSON.stringify(dialog.config()));
   dialog.analyze("");
   report.outTextLn("sources="+dialog.session.rows.map(function(row){return row.sourceLabel}).join(";"));
   report.outTextLn("rgbHint="+dialog.rgbHint.text);
   dialog.channels.R.viewList.currentView=alternate.mainView;
   dialog.channels.R.viewList.onViewSelected(alternate.mainView);
   report.outTextLn("afterSourceChange analyzed="+dialog.analyzed+
      " windows="+dialog.session.windows.length+" save="+dialog.saveButton.enabled+
      " sampling="+JSON.stringify(dialog.channels.R.sampling.text));
   dialog.channels.R.viewList.currentView=r.mainView;
   dialog.analyze("");
   dialog.methodCombo.currentItem=2;
   dialog.methodCombo.onItemSelected(2);
   report.outTextLn("oneRGB="+(!dialog.rgbMode.visible)+
      " noManualWeight="+(dialog.manualWeights()===null));
   dialog.prerequisite.checked=true;
   dialog.registration.checked=true;
   dialog.refreshSummary();
   report.outTextLn("saveEnabled="+dialog.saveButton.enabled);
   dialog.render().save("/tmp/slum-view-ui-probe.png");
   dialog.create();
   report.outTextLn("created="+File.exists(outputPath)+" originalOpen="+(!r.isNull)+
      " pixelUnchanged="+(r.mainView.image.sample(40,60)===original)+
      " modifiedUnchanged="+(r.isModified===modified));
   dialog.session.close();
}catch(e){report.outTextLn("ERROR="+String(e)+" STACK="+e.stack)}
finally{
   for(let i=0;i<windows.length;++i)if(windows[i]&&!windows[i].isNull)windows[i].forceClose();
   if(File.exists(sourcePath))File.remove(sourcePath);
   if(File.exists(outputPath))File.remove(outputPath);
   report.close();
}
