#engine v8
#include "../src/slum-core.js"
#include "../src/slum-stats.js"
#include "../src/slum-spfc.js"
#include "../src/slum-engine.js"
#include "../src/slum-ui.js"
let report=new File;
report.createForWriting("/tmp/pjsr-spfc-ui-probe.txt");
let root=(getEnvironmentVariable("SLUM_ROOT") || ".") + "/";
let d=new SlumDialog;
try {
   d.channels.L.path.text=root+"flux-samples/L_FLUX.xisf";
   d.channels.R.path.text=root+"flux-samples/R_FLUX.xisf";
   d.outputMode.currentItem=1;
   d.outputModeChanged();
   d.analyze("");
   d.refreshSummary();
   report.outTextLn("spfc="+d.session.spfcAvailable+" method="+d.session.method+
      " selected="+d.methodCombo.currentItem+" ready="+d.saveButton.enabled+
      " referenceEnabled="+d.referenceCombo.enabled);
   let rowsBefore=d.session.rows;
   d.lShare.setValue(80);
   d.lShare.onValueUpdated(80);
   report.outTextLn("share="+d.session.lFraction+" sameAnalysis="+(d.session.rows===rowsBefore)+
      " noiseDeferred="+rowsBefore.every(function(r){return r.noise===undefined})+
      " summary80="+(d.report.text.indexOf("80% L + 20% RGBLUM")>=0));
   d.render().save("/tmp/pjsr-spfc-ui-probe.png");
   d.methodCombo.onItemSelected(2);
   d.referenceCombo.onItemSelected(2);
   report.outTextLn("fallback="+d.session.method+" reference="+d.session.reference+
      " sameAnalysis="+d.analyzed);
   d.channels.L.path.text=root+"sample-data/L.fit";
   d.channels.R.path.text=root+"sample-data/R.fit";
   d.analyze("");
   d.refreshSummary();
   report.outTextLn("missing="+!d.session.spfcAvailable+" method="+d.session.method+
      " ready="+d.saveButton.enabled+" reason="+d.session.rows[0].spfc.reason);
   d.methodCombo.onItemSelected(2);
   d.refreshSummary();
   report.outTextLn("explicitFallback="+d.session.method+" ready="+d.saveButton.enabled+
      " defaultReference="+d.session.reference);
   d.methodCombo.onItemSelected(1);
   report.outTextLn("invalidSpfcSelection method="+d.session.method+
      " ready="+d.saveButton.enabled+" selected="+d.methodCombo.currentItem);
} catch(e){report.outTextLn("ERROR="+e+" STACK="+e.stack);}
finally{d.session.close();report.close();}
