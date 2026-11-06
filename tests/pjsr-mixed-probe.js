#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-mixed-probe.txt");
let ids=["L","R","G","B"];
let root="/tmp/slum-mixed-";
let output="/tmp/slum-mixed-result.xisf";
function makeFile(id,index){
   let path=root+id+".xisf";
   if(File.exists(path))File.remove(path);
   let window=new ImageWindow(128,128,1,32,true,false,"Mixed"+id);
   window.mainView.beginProcess();
   for(let y=0;y<128;++y)for(let x=0;x<128;++x)
      window.mainView.image.setSample(0.02+index*0.002+
         ((x*(1973+index*13)+y*(9277+index*23))%1000)/1000000,x,y);
   window.mainView.endProcess();
   window.keywords=[new FITSKeyword("XBINNING",id==="L"?"1":"2"),
      new FITSKeyword("YBINNING",id==="L"?"1":"2")];
   if(!window.saveAs(path,false,false,true,true))throw new Error("test input save failed");
   window.forceClose();
   return path;
}
let session=new SlumSession;
try{
   if(File.exists(output))File.remove(output);
   let config={};
   for(let i=0;i<ids.length;++i)config[ids[i]]={path:makeFile(ids[i],i)};
   let rows=session.analyze(config);
   let sampling={L:"1x1",R:"2x2",G:"2x2",B:"2x2"};
   let weights=session.weights(sampling,{"1x1":0.7,"2x2":0.3});
   let sum=weights.reduce(function(s,w){return s+w.weight},0);
   let rgb=weights.slice(1).reduce(function(s,w){return s+w.weight},0);
   let expected=weights.reduce(function(s,w){
      let row=rows.filter(function(r){return r.id===w.id})[0];
      return s+w.weight*row.view.image.sample(40,60);
   },0);
   report.outTextLn("sampling="+rows.map(function(r){return r.id+":"+r.sampling}).join(","));
   report.outTextLn("weights="+weights.map(function(w){return w.id+":"+w.weight}).join(","));
   report.outTextLn("L="+weights[0].weight+" RGB="+rgb+" sum="+sum);
   session.create(output,sampling,{"1x1":0.7,"2x2":0.3},true);
   let result=ImageWindow.open(output)[0];
   report.outTextLn("pixelDifference="+
      Math.abs(expected-result.mainView.image.sample(40,60)));
   result.forceClose();
}catch(e){report.outTextLn("ERROR="+String(e)+" STACK="+e.stack)}
finally{
   session.close();
   for(let i=0;i<ids.length;++i){let path=root+ids[i]+".xisf";if(File.exists(path))File.remove(path)}
   if(File.exists(output))File.remove(output);
   report.close();
}
