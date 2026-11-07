// Pure calculations shared by PixInsight and the Node test runner.
function chooseReference(channels) {
   if (!channels || channels.length < 2 || channels.length > 4)
      throw new Error("Bitte zwei bis vier Kanäle auswählen.");
   var order = { L: 0, R: 1, G: 2, B: 3 };
   var best = null;
   var seen = Object.create(null);
   for (var i = 0; i < channels.length; ++i) {
      var row = channels[i];
      if (!Object.prototype.hasOwnProperty.call(order, row.id) ||
          seen[row.id] || !isFinite(row.median))
         throw new Error("Ungültiger Kanal oder Medianwert.");
      seen[row.id] = true;
      if (best === null || row.median < best.median ||
          (row.median === best.median && order[row.id] < order[best.id]))
         best = row;
   }
   return best.id;
}

function computeWeights(channels, manualWeights) {
   if (!channels || channels.length < 1 || channels.length > 4)
      throw new Error("Bitte ein bis vier Kanäle gewichten.");
   var seen = Object.create(null);
   var minNoise = Infinity;
   for (var i = 0; i < channels.length; ++i) {
      var row = channels[i];
      if (!/^[LRGB]$/.test(row.id) || seen[row.id] ||
          typeof row.group !== "string" || !row.group ||
          !isFinite(row.noise) || row.noise <= 0)
         throw new Error("Ungültiger Kanal, Sampling-Gruppe oder Noise-Wert.");
      seen[row.id] = true;
      minNoise = Math.min(minNoise, row.noise);
   }
   var denominator = 0;
   if (manualWeights) {
      if (Object.keys(manualWeights).length !== channels.length)
         throw new Error("Manuelles Kanalgewicht fehlt oder ist überzählig.");
      for (var j = 0; j < channels.length; ++j) {
         var share = manualWeights[channels[j].id];
         if (typeof share !== "number" || !isFinite(share) || share < 0 || share > 1)
            throw new Error("Ungültiges manuelles Kanalgewicht.");
         denominator += share;
      }
      if (Math.abs(denominator - 1) > 1e-9)
         throw new Error("Manuelle Kanalgewichte müssen zusammen 100 % ergeben.");
   } else {
      for (var k = 0; k < channels.length; ++k)
         denominator += Math.pow(minNoise / channels[k].noise, 2);
   }
   var result = [];
   for (var m = 0; m < channels.length; ++m) {
      var channel = channels[m];
      result.push({
         id: channel.id,
         group: channel.group,
         noise: channel.noise,
         weight: manualWeights ? manualWeights[channel.id] :
            Math.pow(minNoise / channel.noise, 2) / denominator
      });
   }
   return result;
}

function computeSlumMix(channels, manualWeights, lFraction) {
   if (!channels || channels.length < 2 || channels.length > 4)
      throw new Error("Bitte zwei bis vier Kanäle auswählen.");
   var hasL = channels.some(function (row) { return row.id === "L"; });
   if (!hasL)
      return { weights: computeWeights(channels, manualWeights), rgbWeights: null,
         lFraction: null, weightMode: manualWeights ? "manual" : "auto" };
   if (typeof lFraction !== "number" || !isFinite(lFraction) ||
       lFraction < 0.2 || lFraction > 0.8)
      throw new Error("L-Anteil muss zwischen 20 und 80 % liegen.");
   var luminance = channels.filter(function (row) { return row.id === "L"; });
   var colors = channels.filter(function (row) { return row.id !== "L"; });
   computeWeights(luminance, null); // validate L independently of RGB sampling
   var rgbWeights = computeWeights(colors, manualWeights);
   var weights = channels.map(function (row) {
      if (row.id === "L")
         return { id: row.id, group: row.group, noise: row.noise,
            weight: lFraction };
      var rgb = rgbWeights.filter(function (item) { return item.id === row.id; })[0];
      return { id: row.id, group: row.group, noise: row.noise,
         weight: (1 - lFraction) * rgb.weight };
   });
   return { weights: weights, rgbWeights: rgbWeights,
      lFraction: lFraction, weightMode: manualWeights ? "manual" : "auto" };
}

if (typeof module !== "undefined" && module.exports)
   module.exports = { chooseReference: chooseReference, computeWeights: computeWeights,
      computeSlumMix: computeSlumMix };
