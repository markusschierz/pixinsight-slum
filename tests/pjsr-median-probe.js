#engine v8
#include "../src/slum-stats.js"
let report = new File;
report.createForWriting("/tmp/pjsr-median-probe.txt");
let a = new ImageWindow(4, 1, 1, 32, true, false, "MedianA");
let b = new ImageWindow(4, 1, 1, 32, true, false, "MedianB");
try {
   a.mainView.beginProcess();
   b.mainView.beginProcess();
   [0, 0.1, 0.2, 0.9].forEach(function (v, x) { a.mainView.image.setSample(v, x, 0); });
   [0.9, 0.3, 1, 0.5].forEach(function (v, x) { b.mainView.image.setSample(v, x, 0); });
   a.mainView.endProcess();
   b.mainView.endProcess();
   let result = nativeCommonMedians([a.mainView,b.mainView]);
   report.outTextLn("medians=" + result.join(","));
   report.outTextLn("valid=" + (Math.abs(result[0]-0.5)<1e-6 &&
      Math.abs(result[1]-0.4)<1e-6));
} catch (e) { report.outTextLn("ERROR=" + e.message + " STACK=" + e.stack); }
finally { a.forceClose(); b.forceClose(); report.close(); }
