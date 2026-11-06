#engine v8
#include "../src/slum-stats.js"
let report = new File;
report.createForWriting("/tmp/pjsr-noise-parity.txt");
let window = new ImageWindow(128,128,1,32,true,false,"SLUMNoiseParity");
try {
   window.mainView.beginProcess();
   for (let y=0;y<128;++y) for(let x=0;x<128;++x)
      window.mainView.image.setSample(0.02+((x*1973+y*9277)%1000)/1000000,x,y);
   window.mainView.endProcess();
   let image=window.mainView.image;
   let source=File.readTextFile("/opt/PixInsight/src/scripts/NoiseEvaluation/NoiseEvaluation.js");
   let first=source.indexOf("function ScaledNoiseEvaluation( image )");
   let last=source.indexOf("function main()",first);
   let official=eval(source.substring(first,last)+"\nnew ScaledNoiseEvaluation(image);");
   let actual=estimateNoise(image);
   report.outTextLn("official="+official.sigma+":"+
      (100*official.count/image.selectedRect.area)+":"+official.layers);
   report.outTextLn("actual="+actual.noise+":"+actual.countPercent+":"+actual.layers);
   report.outTextLn("equal="+(official.sigma===actual.noise &&
      100*official.count/image.selectedRect.area===actual.countPercent &&
      official.layers===actual.layers));
} catch(e){report.outTextLn("ERROR="+String(e));}
finally{window.forceClose();report.close();}
