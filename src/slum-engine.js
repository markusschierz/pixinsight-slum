// PixInsight-only image lifecycle. All processing runs on disposable windows.
function selectedChannels(config) {
   var result = [];
   var seen = Object.create(null);
   var ids = ["L", "R", "G", "B"];
   for (var i = 0; i < ids.length; ++i) {
      var id = ids[i];
      var row = config[id] || {};
      var path = String(row.path || "").trim();
      if (!path) continue;
      if (seen[path]) throw new Error("Dieselbe Datei ist mehreren Kanälen zugeordnet.");
      seen[path] = true;
      result.push({ id: id, path: path, sampling: String(row.sampling || "").trim() });
   }
   if (result.length < 2) throw new Error("Bitte mindestens zwei Kanäle auswählen.");
   return result;
}

function samplingKey(value) {
   var text = String(value || "").trim();
   var m = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i.exec(text);
   if (!m) throw new Error("Natives Sampling fehlt oder ist ungültig (Beispiel: 1x1).");
   var x = Number(m[1].replace(",", "."));
   var y = Number(m[2].replace(",", "."));
   if (!isFinite(x) || !isFinite(y) || x <= 0 || y <= 0)
      throw new Error("Natives Sampling muss positiv sein.");
   return x + "x" + y;
}

function keywordMap(window) {
   var result = {};
   var keywords = window.keywords;
   for (var i = 0; i < keywords.length; ++i)
      result[String(keywords[i].name).toUpperCase()] =
         String(keywords[i].value).replace(/^[' ]+|[' ]+$/g, "");
   return result;
}

function nativeSampling(keywords) {
   var x = Number(keywords.XBINNING);
   var y = Number(keywords.YBINNING);
   return isFinite(x) && isFinite(y) && x > 0 && y > 0 ? x + "x" + y : "";
}

function geometrySignature(keywords) {
   var keys = ["CTYPE1", "CTYPE2", "CRPIX1", "CRPIX2", "CRVAL1", "CRVAL2"];
   for (var i = 0; i < keys.length; ++i)
      if (!(keys[i] in keywords)) return "";
   var scale = ("CD1_1" in keywords && "CD2_2" in keywords) ?
      ["CD1_1", "CD1_2", "CD2_1", "CD2_2"] : ["CDELT1", "CDELT2"];
   for (var j = 0; j < scale.length; ++j)
      if (!(scale[j] in keywords)) return "";
   return keys.concat(scale).map(function (key) { return keywords[key]; }).join("|");
}

function astrometricPoints(window, width, height) {
   if (!window.hasAstrometricSolution) return null;
   var positions = [[0, 0], [width / 2, height / 2], [width - 1, height - 1]];
   var points = [];
   for (var i = 0; i < positions.length; ++i) {
      var p = window.imageToCelestial(positions[i][0], positions[i][1]);
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return null;
      points.push([p.x, p.y]);
   }
   return points;
}

function sameAstrometricPoints(a, b) {
   for (var i = 0; i < a.length; ++i)
      for (var c = 0; c < 2; ++c) {
         var d = Math.abs(a[i][c] - b[i][c]);
         if (c === 0) d = Math.min(d, Math.abs(d - 360));
         if (d > 1e-7) return false;
      }
   return true;
}

function closeWindow(window) {
   if (window && !window.isNull) window.forceClose();
}

function SlumSession() {
   this.windows = [];
   this.rows = [];
   this.reference = "";
   this.recommended = "";
   this.registrationCertain = false;
   this.width = 0;
   this.height = 0;
}

SlumSession.prototype.close = function () {
   for (var i = this.windows.length - 1; i >= 0; --i)
      closeWindow(this.windows[i]);
   this.windows = [];
   this.rows = [];
   this.reference = "";
   this.recommended = "";
   this.registrationCertain = false;
   this.width = 0;
   this.height = 0;
};

SlumSession.prototype.analyze = function (config, referenceOverride, progress) {
   this.close();
   progress = progress || function () {};
   var selected = selectedChannels(config);
   for (var a = 0; a < selected.length; ++a)
      for (var b = 0; b < a; ++b)
         if (File.exists(selected[a].path) && File.exists(selected[b].path) &&
             File.sameFile(selected[a].path, selected[b].path))
            throw new Error("Dieselbe Datei ist mehreren Kanälen zugeordnet.");
   var signatures = [];
   var astrometry = [];
   try {
      for (var i = 0; i < selected.length; ++i) {
         var row = selected[i];
         if (!File.exists(row.path)) throw new Error(row.id + ": Datei fehlt: " + row.path);
         var opened = ImageWindow.open(row.path);
         if (opened.length !== 1) {
            for (var n = 0; n < opened.length; ++n) closeWindow(opened[n]);
            throw new Error(row.id + ": genau ein monochromes Bild pro Datei erforderlich.");
         }
         var original = opened[0];
         try {
            var image = original.mainView.image;
            if (image.isColor || image.numberOfChannels !== 1 || !image.isReal)
               throw new Error(row.id + ": nur reelle Monochrombilder ohne Alphakanal erlaubt.");
            if (i === 0) {
               this.width = image.width;
               this.height = image.height;
            } else if (image.width !== this.width || image.height !== this.height)
               throw new Error(row.id + ": Bildabmessungen weichen ab.");
            var keywords = keywordMap(original);
            signatures.push(geometrySignature(keywords));
            astrometry.push(astrometricPoints(original, image.width, image.height));
            var work = new ImageWindow(image.width, image.height, 1, 32, true, false,
               "SLUMWork" + row.id);
            this.windows.push(work);
            work.mainView.beginProcess();
            try { work.mainView.image.assign(image); }
            finally { work.mainView.endProcess(); }
            this.rows.push({ id: row.id, path: row.path, view: work.mainView,
               sampling: row.sampling || nativeSampling(keywords),
               detectedSampling: nativeSampling(keywords) });
         } finally {
            closeWindow(original);
         }
         progress("Eingabe " + row.id + " geladen");
      }
      var complete = signatures.filter(function (s) { return !!s; });
      var solved = astrometry.filter(function (a) { return !!a; });
      if (complete.some(function (s) { return s !== complete[0]; }) ||
          solved.some(function (a) { return !sameAstrometricPoints(a, solved[0]); }))
         throw new Error("WCS-Metadaten zeigen unterschiedliche Ausgaberaster.");
      this.registrationCertain = solved.length === astrometry.length ||
         complete.length === signatures.length;
      var medians = nativeCommonMedians(this.rows.map(function (r) { return r.view; }));
      progress("Median berechnet");
      for (var m = 0; m < this.rows.length; ++m) this.rows[m].median = medians[m];
      this.recommended = chooseReference(this.rows);
      this.reference = referenceOverride || this.recommended;
      if (!this.rows.some(function (r) { return r.id === this.reference; }, this))
         throw new Error("Die gewählte Referenz gehört nicht zu den Eingaben.");
      var reference = this.rows.filter(function (r) { return r.id === this.reference; }, this)[0];
      for (var k = 0; k < this.rows.length; ++k) {
         var target = this.rows[k];
         if (target.id !== this.reference) {
            var fit = new LinearFit;
            fit.referenceViewId = reference.view.id;
            fit.rejectLow = 0;
            fit.rejectHigh = 0.92;
            if (!fit.executeOn(target.view)) throw new Error(target.id + ": LinearFit fehlgeschlagen.");
         }
         var estimate = estimateNoise(target.view.image);
         target.noise = estimate.noise;
         target.countPercent = estimate.countPercent;
         target.layers = estimate.layers;
         progress("Noise " + target.id + " gemessen");
      }
      return this.rows;
   } catch (error) {
      this.close();
      throw error;
   }
};

SlumSession.prototype.weights = function (sampling, shares) {
   if (this.rows.length < 2) throw new Error("Zuerst Bilder analysieren.");
   var members = this.rows.map(function (r) {
      return { id: r.id, group: samplingKey(sampling[r.id]), noise: r.noise };
   });
   return computeWeights(members, shares);
};

SlumSession.prototype.create = function (path, sampling, shares, registrationConfirmed, progress) {
   progress = progress || function () {};
   if (!this.rows.length) throw new Error("Zuerst Bilder analysieren.");
   if (!this.registrationCertain && !registrationConfirmed)
      throw new Error("Gleiches registriertes Raster bitte ausdrücklich bestätigen.");
   if (!/\.xisf$/i.test(path)) throw new Error("Ausgabe muss eine .xisf-Datei sein.");
   if (File.exists(path)) throw new Error("Ausgabedatei existiert bereits.");
   var weights = this.weights(sampling, shares);
   var expression = weights.map(function (row) {
      var source = this.rows.filter(function (r) { return r.id === row.id; })[0];
      return "(" + row.weight.toPrecision(17) + "*" + source.view.id + ")";
   }, this).join("+");
   var temporaryPath = path.replace(/\.xisf$/i, ".slum-partial.xisf");
   if (File.exists(temporaryPath)) throw new Error("Temporärer Ausgabepfad ist bereits belegt.");
   var output = null;
   try {
      progress("SLUM wird berechnet");
      var p = new PixelMath;
      p.expression = expression;
      p.useSingleExpression = true;
      p.generateOutput = true;
      p.createNewImage = true;
      p.showNewImage = false;
      p.rescale = false;
      p.truncate = false;
      var outputId = uniqueSlumViewId("SLUMOutput");
      p.newImageId = outputId;
      p.newImageColorSpace = PixelMath.Gray;
      p.newImageSampleFormat = PixelMath.f32;
      if (!p.executeOn(this.rows[0].view)) throw new Error("PixelMath fehlgeschlagen.");
      output = View.viewById(outputId).window;
      if (output.mainView.image.numberOfChannels !== 1 || output.bitsPerSample !== 32 ||
          !output.isFloatSample)
         throw new Error("Ausgabeformat ist nicht 32-Bit-Float-Graustufen.");
      progress("SLUM wird gespeichert");
      if (!output.saveAs(temporaryPath, false, false, true, true))
         throw new Error("XISF konnte nicht gespeichert werden.");
      progress("Temporäre XISF gespeichert");
      if (File.exists(path)) throw new Error("Ausgabedatei existiert bereits.");
      File.move(temporaryPath, path);
      return weights;
   } catch (error) {
      if (File.exists(temporaryPath)) File.remove(temporaryPath);
      throw error;
   } finally {
      closeWindow(output);
      this.close();
   }
};

if (typeof module !== "undefined" && module.exports)
   module.exports = { selectedChannels: selectedChannels, samplingKey: samplingKey,
      nativeSampling: nativeSampling, geometrySignature: geometrySignature,
      sameAstrometricPoints: sameAstrometricPoints };
