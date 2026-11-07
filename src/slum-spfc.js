// SPFC stores calibration estimates as image properties; it does not alter pixels.
// Version 1 ScaleFactors are normalized by NormalizationFactor. All inputs in a
// run must use the same normalization, so multiplying by K[0] puts them on the
// same (arbitrarily normalized) physical flux scale.
function validateSpfcProperties(p) {
   if (!p || p.scale == null) return { valid: false, reason: "SPFC-Skalierungsfaktor fehlt" };
   if (p.version !== 1) return { valid: false, reason: "SPFC-Version fehlt oder wird nicht unterstützt" };
   if (typeof p.normalization !== "number" || !isFinite(p.normalization) || p.normalization <= 0)
      return { valid: false, reason: "SPFC-Normierungsfaktor fehlt oder ist ungültig" };
   var vectors = [["scale", "Skalierungsfaktor"], ["sigma", "Streuung"],
      ["fwhmx", "FWHMx"], ["fwhmy", "FWHMy"], ["counts", "Sternanzahl"]];
   for (var i = 0; i < vectors.length; ++i) {
      var name = vectors[i][0], value = p[name];
      if (!value || value.length !== 1 || typeof value[0] !== "number" ||
          !isFinite(value[0]) || (name === "sigma" ? value[0] < 0 : value[0] <= 0) ||
          (name === "counts" && Math.floor(value[0]) !== value[0]))
         return { valid: false, reason: "SPFC-" + vectors[i][1] + " fehlt oder ist ungültig" };
   }
   return { valid: true, scale: Number(p.scale[0]),
      normalization: Number(p.normalization), version: 1,
      sigma: Number(p.sigma[0]), count: Number(p.counts[0]) };
}

function readSpfc(view) {
   var prefix = "PCL:SPFC:";
   var value = function (name) { return view.hasProperty(prefix + name) ?
      view.propertyValue(prefix + name) : null; };
   var result;
   try {
      result = validateSpfcProperties({
         scale: value("ScaleFactors"), sigma: value("Sigmas"),
         fwhmx: value("FWHMx"), fwhmy: value("FWHMy"),
         counts: value("Counts"), normalization: value("NormalizationFactor"),
         version: value("Version")
      });
   } catch (error) {
      return { valid: false, reason: "SPFC-Eigenschaften nicht lesbar: " + error.message };
   }
   return result;
}

function checkSpfcSet(rows) {
   var first = null, complete = true;
   for (var i = 0; i < rows.length; ++i) {
      var s = rows[i].spfc;
      if (!s.valid) { complete = false; continue; }
      if (!first) first = s;
      else if (s.version !== first.version || s.normalization !== first.normalization) {
         rows[i].spfc = { valid: false, reason: "SPFC-Version oder Normierung weicht von anderen Kanälen ab" };
         complete = false;
      }
   }
   return complete;
}

if (typeof module !== "undefined" && module.exports)
   module.exports = { validateSpfcProperties: validateSpfcProperties,
      readSpfc: readSpfc, checkSpfcSet: checkSpfcSet };
