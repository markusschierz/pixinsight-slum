// Image.sample() is a PixInsight method; tests provide the same small interface.
function sampleMedians(images, maxSamples) {
   if (!images || images.length < 2 || images.length > 4)
      throw new Error("Select two to four images.");
   var width = images[0].width;
   var height = images[0].height;
   for (var i = 1; i < images.length; ++i)
      if (images[i].width !== width || images[i].height !== height)
         throw new Error("Images must have the same dimensions.");
   var limit = maxSamples || 100000;
   var step = Math.max(1, Math.ceil(Math.sqrt(width * height / limit)));
   var values = images.map(function () { return []; });
   for (var y = 0; y < height; y += step)
      for (var x = 0; x < width; x += step) {
         var pixel = [];
         var valid = true;
         for (var c = 0; c < images.length; ++c) {
            var v = images[c].sample(x, y);
            if (!isFinite(v) || v <= 0 || v >= 1) {
               valid = false;
               break;
            }
            pixel.push(v);
         }
         if (valid)
            for (var k = 0; k < images.length; ++k)
               values[k].push(pixel[k]);
      }
   if (values[0].length === 0)
      throw new Error("No common valid pixels for a median.");
   return values.map(function (samples) {
      samples.sort(function (a, b) { return a - b; });
      var middle = Math.floor(samples.length / 2);
      return samples.length % 2 ? samples[middle] :
         (samples[middle - 1] + samples[middle]) / 2;
   });
}

// Matches the method in PixInsight's bundled NoiseEvaluation script v2.1.1.
function estimateNoise(image) {
   var scale = image.Sn();
   var area = image.selectedRect.area;
   if (!isFinite(scale) || scale <= 0 || !isFinite(area) || area <= 0)
      throw new Error("Invalid noise scale or image area.");
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
   if (!isFinite(noise) || noise <= 0 || !isFinite(result[1]))
      throw new Error("Invalid noise estimate.");
   return { noise: noise, countPercent: 100 * result[1] / area, layers: layers };
}

if (typeof module !== "undefined" && module.exports)
   module.exports = { sampleMedians: sampleMedians, estimateNoise: estimateNoise };
