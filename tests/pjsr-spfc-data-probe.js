#engine v8
let report = new File;
report.createForWriting("/tmp/pjsr-spfc-data-probe.txt");
let root = "/home/markus/Nextcloud/Documents/_devleopment/pixsinsight-slum/";
try {
   for (let id of ["L", "R", "G", "B"]) {
      let raw = ImageWindow.open(root + "sample-data/" + id + ".fit")[0];
      let flux = ImageWindow.open(root + "flux-samples/" + id + "_FLUX.xisf")[0];
      try {
         let v = flux.mainView;
         let k = v.propertyValue("PCL:SPFC:ScaleFactors");
         let n = v.propertyValue("PCL:SPFC:NormalizationFactor");
         let version = v.propertyValue("PCL:SPFC:Version");
         report.outTextLn(id + " K=" + k + " length=" + k.length + " first=" + k[0] + " N=" + n + " V=" + version);
         for (let xy of [[4000,3000],[1200,2500],[8000,5000]]) {
            let x=xy[0], y=xy[1];
            let a=raw.mainView.image.sample(x,y), b=v.image.sample(x,y);
            report.outTextLn("  "+x+","+y+" raw="+a+" flux="+b+" diff="+(b-a));
         }
      } finally { raw.forceClose(); flux.forceClose(); }
   }
} catch (e) { report.outTextLn("ERROR="+e+" STACK="+e.stack); }
finally { report.close(); }
