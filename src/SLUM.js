#engine v8
#feature-id    Utilities > SLUM
#feature-info  Erstellt eine lineare Super-Luminanz aus 2–4 registrierten Monochrom-Mastern.
#include "slum-core.js"
#include "slum-stats.js"
#include "slum-engine.js"
#include "slum-ui.js"

var dialog = new SlumDialog;
try { dialog.execute(); }
finally { dialog.session.close(); }
