#engine v8
let report=new File;
report.createForWriting("/tmp/pjsr-spfc-wcs-probe.txt");
let root="/home/markus/Nextcloud/Documents/_devleopment/pixsinsight-slum/flux-samples/";
try {
   for(let id of ["L","R","G","B"]){
      let w=ImageWindow.open(root+id+"_FLUX.xisf")[0];
      try {
         report.outTextLn(id+" solved="+w.hasAstrometricSolution);
         for(let xy of [[0,0],[4000,3000],[9354,6251]]){
            let p=w.imageToCelestial(xy[0],xy[1]);
            report.outTextLn("  "+xy+" -> "+p.x+","+p.y);
         }
      } finally {w.forceClose();}
   }
} catch(e){report.outTextLn("ERROR="+e+" STACK="+e.stack);}
finally{report.close();}
