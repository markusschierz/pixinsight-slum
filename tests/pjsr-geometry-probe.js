#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-engine.js"
let report = new File;
report.createForWriting("/tmp/pjsr-geometry-probe.txt");
let files=["/tmp/slum-geometry-a.xisf","/tmp/slum-geometry-b.xisf","/tmp/slum-geometry-c.xisf"];
function make(path,w,shift){
   if(File.exists(path))File.remove(path);
   let win=new ImageWindow(w,64,1,32,true,false,"Geometry");
   win.mainView.beginProcess();
   for(let y=0;y<64;++y)for(let x=0;x<w;++x)
      win.mainView.image.setSample(0.02+((x*1973+y*9277)%1000)/1000000,x,y);
   win.mainView.endProcess();
   let keys={CTYPE1:"RA---TAN",CTYPE2:"DEC--TAN",CRPIX1:String(10+shift),CRPIX2:"20",
      CRVAL1:"30",CRVAL2:"40",CDELT1:"0.1",CDELT2:"0.1"};
   win.keywords=Object.keys(keys).map(function(k){return new FITSKeyword(k,keys[k])});
   win.saveAs(path,false,false,true,true);
   win.forceClose();
}
let session=new SlumSession;
try{
   make(files[0],64,0);make(files[1],65,0);make(files[2],64,1);
   try{session.analyze({R:{path:files[0]},B:{path:files[1]}})}
   catch(e){report.outTextLn("dimensions="+String(e)+" cleanup="+session.windows.length)}
   let aw=ImageWindow.open(files[0])[0],cw=ImageWindow.open(files[2])[0];
   report.outTextLn("A="+JSON.stringify(keywordMap(aw))+" C="+JSON.stringify(keywordMap(cw)));
   report.outTextLn("solutions="+aw.hasAstrometricSolution+":"+cw.hasAstrometricSolution+
      " centers="+JSON.stringify(aw.imageToCelestial(32,32))+":"+
      JSON.stringify(cw.imageToCelestial(32,32)));
   aw.forceClose();cw.forceClose();
   try{session.analyze({R:{path:files[0]},B:{path:files[2]}});
      report.outTextLn("wcsAccepted certain="+session.registrationCertain)}
   catch(e){report.outTextLn("wcs="+String(e)+" cleanup="+session.windows.length)}
   try{session.analyze({R:{path:files[0]},B:{path:"/tmp/./slum-geometry-a.xisf"}})}
   catch(e){report.outTextLn("sameFile="+String(e)+" cleanup="+session.windows.length)}
}catch(e){report.outTextLn("ERROR="+String(e))}
finally{session.close();for(let i=0;i<files.length;++i)if(File.exists(files[i]))File.remove(files[i]);report.close()}
