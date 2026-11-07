// PixInsight-only image lifecycle. All processing runs on disposable windows.
function selectedChannels(config) {
   var result = [];
   var seenPaths = Object.create(null);
   var seenViews = Object.create(null);
   var ids = ["L", "R", "G", "B"];
   for (var i = 0; i < ids.length; ++i) {
      var id = ids[i];
      var row = config[id] || {};
      var source = row.source || (row.viewId ? "view" : "file");
      var selected = { id: id, source: source,
         sampling: String(row.sampling || "").trim() };
      if (source === "file") {
         selected.path = String(row.path || "").trim();
         if (!selected.path) continue;
         if (seenPaths[selected.path])
            throw new Error("Dieselbe Datei ist mehreren Kanälen zugeordnet.");
         seenPaths[selected.path] = true;
      } else if (source === "view") {
         selected.viewId = String(row.viewId || "").trim();
         if (!selected.viewId) continue;
         if (seenViews[selected.viewId])
            throw new Error("Dieselbe Ansicht ist mehreren Kanälen zugeordnet.");
         seenViews[selected.viewId] = true;
      } else {
         throw new Error("Ungültiger Quelltyp für " + id + ".");
      }
      result.push(selected);
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

function nearAstrometricPoints(a, b, width, height) {
   // Independent plate solves can differ slightly even when the pixels are
   // registered. Reject offsets over two output pixels; report smaller uncertainty.
   var raSpan = Math.abs(a[0][0] - a[1][0]);
   raSpan = Math.min(raSpan, 360 - raSpan);
   var dec = (a[0][1] + a[1][1]) * Math.PI / 360;
   var scale = Math.sqrt(Math.pow(raSpan * Math.cos(dec), 2) +
      Math.pow(a[0][1] - a[1][1], 2)) /
      Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
   if (!isFinite(scale) || scale <= 0) return false;
   for (var i = 0; i < a.length; ++i) {
      var dra = Math.abs(a[i][0] - b[i][0]);
      dra = Math.min(dra, 360 - dra);
      var delta = Math.sqrt(Math.pow(dra * Math.cos(a[i][1] * Math.PI / 180), 2) +
         Math.pow(a[i][1] - b[i][1], 2));
      if (delta > 2 * scale) return false;
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
   this.prepared = false;
   this.method = "";
   this.spfcAvailable = false;
   this.lFraction = 0.7;
   this.mix = null;
   this.lastRun = null;
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
   this.prepared = false;
   this.method = "";
   this.spfcAvailable = false;
   this.mix = null;
};

SlumSession.prototype.analyze = function (config, referenceOverride, progress) {
   this.close();
   this.lastRun = null;
   progress = progress || function () {};
   var selected = selectedChannels(config);
   var sourceViews = [];
   var sourcePaths = [];
   for (var q = 0; q < selected.length; ++q) {
      var input = selected[q];
      if (input.source === "view") {
         var loaded = View.viewById(input.viewId);
         if (!loaded || loaded.isNull || !loaded.isMainView ||
             !loaded.window || loaded.window.isNull)
            throw new Error(input.id + ": geöffnete Hauptansicht fehlt: " + input.viewId);
         sourceViews.push(loaded);
         sourcePaths.push(loaded.window.filePath);
      } else {
         sourceViews.push(null);
         sourcePaths.push(input.path);
      }
   }
   for (var a = 0; a < selected.length; ++a)
      for (var b = 0; b < a; ++b)
         if (sourcePaths[a] && sourcePaths[b] && File.exists(sourcePaths[a]) &&
             File.exists(sourcePaths[b]) && File.sameFile(sourcePaths[a], sourcePaths[b]))
            throw new Error("Dieselbe Quelldatei ist mehreren Kanälen zugeordnet.");
   var signatures = [];
   var astrometry = [];
   try {
      for (var i = 0; i < selected.length; ++i) {
         var row = selected[i];
         var sourceWindow, sourceView, openedByUs = false;
         if (row.source === "file") {
            if (!File.exists(row.path)) throw new Error(row.id + ": Datei fehlt: " + row.path);
            var opened = ImageWindow.open(row.path);
            if (opened.length !== 1) {
               for (var n = 0; n < opened.length; ++n) closeWindow(opened[n]);
               throw new Error(row.id + ": genau ein monochromes Bild pro Datei erforderlich.");
            }
            sourceWindow = opened[0];
            sourceView = sourceWindow.mainView;
            openedByUs = true;
         } else {
            sourceView = sourceViews[i];
            if (!sourceView || sourceView.isNull)
               throw new Error(row.id + ": gewählte Ansicht wurde geschlossen.");
            sourceWindow = sourceView.window;
         }
         try {
            var image = sourceView.image;
            if (image.isColor || image.numberOfChannels !== 1 || !image.isReal)
               throw new Error(row.id + ": nur reelle Monochrombilder ohne Alphakanal erlaubt.");
            if (i === 0) {
               this.width = image.width;
               this.height = image.height;
            } else if (image.width !== this.width || image.height !== this.height)
               throw new Error(row.id + ": Bildabmessungen weichen ab.");
            var keywords = keywordMap(sourceWindow);
            var spfc = readSpfc(sourceView);
            signatures.push(geometrySignature(keywords));
            astrometry.push(astrometricPoints(sourceWindow, image.width, image.height));
            var work = new ImageWindow(image.width, image.height, 1, 32, true, false,
               "SLUMWork" + row.id);
            this.windows.push(work);
            work.mainView.beginProcess();
            try { work.mainView.image.assign(image); }
            finally { work.mainView.endProcess(); }
            this.rows.push({ id: row.id, source: row.source, path: row.path || "",
               viewId: row.viewId || "", sourceLabel: row.source === "file" ?
                  "Datei: " + row.path : "Ansicht: " + row.viewId,
               view: work.mainView,
               spfc: spfc,
               sampling: row.sampling || nativeSampling(keywords),
               detectedSampling: nativeSampling(keywords) });
         } finally {
            if (openedByUs) closeWindow(sourceWindow);
         }
         progress("Eingabe " + row.id + " geladen");
      }
      var complete = signatures.filter(function (s) { return !!s; });
      var solved = astrometry.filter(function (a) { return !!a; });
      if (solved.length === astrometry.length) {
         if (solved.some(function (a) {
            return !nearAstrometricPoints(a, solved[0], this.width, this.height);
         }, this)) throw new Error("WCS-Metadaten zeigen einen Versatz von mehr als zwei Pixeln.");
         this.registrationCertain = solved.every(function (a) {
            return sameAstrometricPoints(a, solved[0]);
         });
      } else {
         if (complete.some(function (s) { return s !== complete[0]; }) ||
             solved.some(function (a) { return !sameAstrometricPoints(a, solved[0]); }))
            throw new Error("WCS-Metadaten zeigen unterschiedliche Ausgaberaster.");
         this.registrationCertain = complete.length === signatures.length;
      }
      var medians = nativeCommonMedians(this.rows.map(function (r) { return r.view; }));
      progress("Median berechnet");
      for (var m = 0; m < this.rows.length; ++m) this.rows[m].median = medians[m];
      this.spfcAvailable = checkSpfcSet(this.rows);
      this.method = this.spfcAvailable ? "spfc" : "";
      this.recommended = this.rows.some(function (r) { return r.id === "L"; }) ?
         "L" : chooseReference(this.rows);
      this.selectReference(referenceOverride || this.recommended);
      return this.rows;
   } catch (error) {
      this.close();
      throw error;
   }
};

SlumSession.prototype.selectReference = function (id) {
   if (this.prepared) throw new Error("Nach LinearFit bitte erneut analysieren.");
   if (!this.rows.some(function (r) { return r.id === id; }))
      throw new Error("Die gewählte Referenz gehört nicht zu den Eingaben.");
   this.reference = id;
};

SlumSession.prototype.selectMethod = function (method) {
   if (this.prepared) throw new Error("Nach der Normalisierung bitte erneut analysieren.");
   if (method !== "" && method !== "spfc" && method !== "linearFit")
      throw new Error("Ungültiges Normalisierungsverfahren.");
   if (method === "spfc" && !this.spfcAvailable)
      throw new Error("SPFC ist nicht für alle gewählten Kanäle gültig.");
   this.method = method;
};

SlumSession.prototype.setLuminanceFraction = function (value) {
   if (this.prepared) throw new Error("Nach der Normalisierung bitte erneut analysieren.");
   if (typeof value !== "number" || !isFinite(value) || value < 0.5 || value > 0.8)
      throw new Error("L-Anteil muss zwischen 50 und 80 % liegen.");
   this.lFraction = value;
};

SlumSession.prototype.prepare = function (progress) {
   if (this.prepared) return;
   progress = progress || function () {};
   if (!this.reference) throw new Error("Zuerst Referenz auswählen.");
   if (!this.method) throw new Error("SPFC nachholen oder LinearFit ausdrücklich wählen.");
   var reference = this.rows.filter(function (r) { return r.id === this.reference; }, this)[0];
   for (var k = 0; k < this.rows.length; ++k) {
      var target = this.rows[k];
      if (this.method === "spfc") {
         progress("SPFC-Flux " + target.id + " wird skaliert");
         target.view.beginProcess(UndoFlag.NoSwapFile);
         try { target.view.image.apply(target.spfc.scale, ImageOp.Mul); }
         finally { target.view.endProcess(); }
      } else if (target.id !== this.reference) {
         progress("LinearFit " + target.id + " auf " + this.reference);
         var fit = new LinearFit;
         fit.referenceViewId = reference.view.id;
         fit.rejectLow = 0;
         fit.rejectHigh = 0.92;
         if (!fit.executeOn(target.view)) throw new Error(target.id + ": LinearFit fehlgeschlagen.");
      }
      progress("Noise " + target.id + " wird gemessen");
      var estimate = estimateNoise(target.view.image);
      target.noise = estimate.noise;
      target.countPercent = estimate.countPercent;
      target.layers = estimate.layers;
   }
   this.prepared = true;
};

SlumSession.prototype.validateMix = function (sampling, manualWeights) {
   if (this.rows.length < 2) throw new Error("Zuerst Bilder analysieren.");
   return computeSlumMix(this.rows.map(function (r) {
      return { id: r.id, group: samplingKey(sampling[r.id]), noise: 1 };
   }), manualWeights, this.lFraction);
};

SlumSession.prototype.weights = function (sampling, manualWeights) {
   if (!this.prepared) throw new Error("Noise wird erst bei der Ausgabe gemessen.");
   var members = this.rows.map(function (r) {
      return { id: r.id, group: samplingKey(sampling[r.id]), noise: r.noise };
   });
   this.mix = computeSlumMix(members, manualWeights, this.lFraction);
   return this.mix.weights;
};

SlumSession.prototype.captureRun = function (weights) {
   this.lastRun = { method: this.method, recommended: this.recommended, reference: this.reference,
      lFraction: this.mix.lFraction, rgbWeights: this.mix.rgbWeights,
      weightMode: this.mix.weightMode,
      weights: weights, rows: this.rows.map(function (r) {
         return { id: r.id, sourceLabel: r.sourceLabel, median: r.median,
            noise: r.noise, countPercent: r.countPercent, layers: r.layers,
            spfc: r.spfc };
      }) };
};

SlumSession.prototype.checkReady = function () {
   if (!this.rows.length) throw new Error("Zuerst Bilder analysieren.");
};

SlumSession.prototype.renderOutput = function (weights, outputId) {
   var term = function (row) {
      var source = this.rows.filter(function (r) { return r.id === row.id; })[0];
      return "(" + row.weight.toPrecision(17) + "*" + source.view.id + ")";
   };
   var expression;
   if (this.mix && this.mix.lFraction !== null) {
      var luminance = this.rows.filter(function (row) { return row.id === "L"; })[0];
      var rgbExpression = this.mix.rgbWeights.map(term, this).join("+");
      expression = "(" + this.mix.lFraction.toPrecision(17) + "*" + luminance.view.id +
         ")+(" + (1 - this.mix.lFraction).toPrecision(17) + "*(" + rgbExpression + "))";
   } else {
      expression = weights.map(term, this).join("+");
   }
   var output = null;
   try {
      var p = new PixelMath;
      p.expression = expression;
      p.useSingleExpression = true;
      p.generateOutput = true;
      p.createNewImage = true;
      p.showNewImage = false;
      p.rescale = false;
      p.truncate = false;
      p.newImageId = outputId;
      p.newImageColorSpace = PixelMath.Gray;
      p.newImageSampleFormat = PixelMath.f32;
      if (!p.executeOn(this.rows[0].view)) throw new Error("PixelMath fehlgeschlagen.");
      output = View.viewById(outputId).window;
      if (output.mainView.image.numberOfChannels !== 1 || output.bitsPerSample !== 32 ||
          !output.isFloatSample)
         throw new Error("Ausgabeformat ist nicht 32-Bit-Float-Graustufen.");
      return output;
   } catch (error) {
      closeWindow(output);
      throw error;
   }
};

SlumSession.prototype.create = function (path, sampling, manualWeights, progress) {
   progress = progress || function () {};
   this.checkReady();
   if (!/\.xisf$/i.test(path)) throw new Error("Ausgabe muss eine .xisf-Datei sein.");
   if (File.exists(path)) throw new Error("Ausgabedatei existiert bereits.");
   this.validateMix(sampling, manualWeights);
   var temporaryPath = path.replace(/\.xisf$/i, ".slum-partial.xisf");
   if (File.exists(temporaryPath)) throw new Error("Temporärer Ausgabepfad ist bereits belegt.");
   var output = null;
   try {
      this.prepare(progress);
      var weights = this.weights(sampling, manualWeights);
      progress("SLUM wird berechnet");
      output = this.renderOutput(weights, uniqueSlumViewId("SLUMOutput"));
      progress("SLUM wird gespeichert");
      if (!output.saveAs(temporaryPath, false, false, true, true))
         throw new Error("XISF konnte nicht gespeichert werden.");
      progress("Temporäre XISF gespeichert");
      if (File.exists(path)) throw new Error("Ausgabedatei existiert bereits.");
      File.move(temporaryPath, path);
      this.captureRun(weights);
      return weights;
   } catch (error) {
      if (File.exists(temporaryPath)) File.remove(temporaryPath);
      throw error;
   } finally {
      closeWindow(output);
      this.close();
   }
};

SlumSession.prototype.createView = function (sampling, manualWeights, progress) {
   progress = progress || function () {};
   this.checkReady();
   this.validateMix(sampling, manualWeights);
   var output = null;
   var completed = false;
   try {
      this.prepare(progress);
      var weights = this.weights(sampling, manualWeights);
      progress("SLUM wird berechnet");
      var outputId = "SLUM";
      var n = 1;
      for (var existing = View.viewById(outputId);
           existing && !existing.isNull;
           existing = View.viewById(outputId))
         outputId = "SLUM_" + n++;
      output = this.renderOutput(weights, outputId);
      progress("SLUM-Ansicht wird ausgegeben");
      output.show();
      output.bringToFront();
      this.captureRun(weights);
      completed = true;
      return { viewId: outputId, weights: weights };
   } finally {
      if (!completed) closeWindow(output);
      this.close();
   }
};

if (typeof module !== "undefined" && module.exports)
   module.exports = { selectedChannels: selectedChannels, samplingKey: samplingKey,
      nativeSampling: nativeSampling, geometrySignature: geometrySignature,
      sameAstrometricPoints: sameAstrometricPoints,
      nearAstrometricPoints: nearAstrometricPoints };
