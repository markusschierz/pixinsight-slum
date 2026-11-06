// Exact full-image median over the same valid pixel positions in all channels.
// PixInsight computes the median natively; only one masked temporary exists at a time.
function nativeCommonMedians(views) {
   if (!views || views.length < 2 || views.length > 4)
      throw new Error("Bitte zwei bis vier Bildansichten auswählen.");
   var valid = views.map(function (view) {
      return "(" + view.id + ">0)*(" + view.id + "<1)";
   }).join("*");
   var medians = [];
   for (var i = 0; i < views.length; ++i) {
      var id = uniqueSlumViewId("SLUMMedian");
      var p = new PixelMath;
      p.expression = "iif(" + valid + "," + views[i].id + ",-1)";
      p.useSingleExpression = true;
      p.generateOutput = true;
      p.createNewImage = true;
      p.showNewImage = false;
      p.rescale = false;
      p.truncate = false;
      p.newImageId = id;
      p.newImageColorSpace = PixelMath.Gray;
      p.newImageSampleFormat = PixelMath.f32;
      var temporary = null;
      try {
         if (!p.executeOn(views[i]))
            throw new Error("Berechnung der Medianmaske fehlgeschlagen.");
         temporary = View.viewById(id).window;
         var image = temporary.mainView.image;
         image.rangeClippingEnabled = true;
         image.rangeClipLow = 0;
         image.rangeClipHigh = 1;
         var median = image.median();
         if (!isFinite(median) || median <= 0 || median >= 1)
            throw new Error("Keine gemeinsamen gültigen Pixel für den Median.");
         medians.push(median);
      } finally {
         if (temporary && !temporary.isNull)
            temporary.forceClose();
      }
   }
   return medians;
}

function uniqueSlumViewId(prefix) {
   var id, existing;
   do {
      id = prefix + Math.floor(Math.random() * 1000000000);
      existing = View.viewById(id);
   } while (existing && !existing.isNull);
   return id;
}

// Matches the method in PixInsight's bundled NoiseEvaluation script v2.1.1.
function estimateNoise(image) {
   var scale = image.Sn();
   var area = image.selectedRect.area;
   if (!isFinite(scale) || scale <= 0 || 1 + scale === 1 ||
       !isFinite(area) || area <= 0)
      throw new Error("Ungültige Noise-Skala oder Bildfläche.");
   var result;
   var layers = 4;
   var minimumCount = 0.01 * area;
   for (;;) {
      result = image.noiseMRS(layers);
      if (result[1] >= minimumCount) break;
      if (--layers === 1) {
         result = image.noiseKSigma();
         break;
      }
   }
   var noise = result[0] / scale;
   if (!isFinite(noise) || noise <= 0 || !isFinite(result[1]) ||
       result[1] < 0 || result[1] > area)
      throw new Error("Ungültiger Noise-Wert.");
   return { noise: noise, countPercent: 100 * result[1] / area, layers: layers };
}

function countWarning(percent) {
   if (!isFinite(percent) || percent < 0 || percent > 100)
      throw new Error("Ungültiger count-Prozentwert.");
   if (percent < 25) return "DEUTLICHE WARNUNG: count <25%";
   if (percent < 50) return "Warnung: count <50%";
   return "";
}

if (typeof module !== "undefined" && module.exports)
   module.exports = { nativeCommonMedians: nativeCommonMedians,
      estimateNoise: estimateNoise, countWarning: countWarning };
