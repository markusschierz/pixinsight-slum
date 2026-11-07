#engine v8
#feature-id    SLUM : astro-foto.ch > SLUM
#feature-icon  SLUM.svg
#feature-info  Erstellt eine lineare Super-Luminanz aus 2–4 registrierten Monochrom-Mastern.
// Feature metadata: https://pixinsight.com/doc/docs/PJSR/PJSR.html#lbl_metadata
CoreApplication.ensureMinimumVersion( 1, 9, 6 );
#include "slum-core.js"
#include "slum-stats.js"
#include "slum-spfc.js"
#include "slum-engine.js"
#include "slum-ui.js"

var dialog = new SlumDialog;
try { dialog.execute(); }
finally { dialog.session.close(); }
