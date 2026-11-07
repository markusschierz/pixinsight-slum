// Native PixInsight dialog. Analysis stays in memory until output or cancel.
class SlumDialog extends Dialog {
   constructor() {
      super();
      this.windowTitle = "SLUM – Super-Luminanz";
      this.labelWidth = 150;
      this.userResizable = true;
      this.minWidth = 760;
      this.session = new SlumSession;
      this.analyzed = false;
      this.suppress = false;
      this.channels = {};
      this.manualFields = {};
      this.busy = false;
      this.cancelRequested = false;
      this.closeAfterCancel = false;
      this.lastOutputViewId = "";

      var main = new VerticalSizer;
      main.margin = 16;
      main.spacing = 8;
      var intro = new Label(this);
      intro.useRichText = true;
      intro.text = "<b>SLUM aus 2–4 linearen Monochrom-Mastern</b><br/>" +
         "Je Kanal eine Datei oder eine geöffnete Hauptansicht wählen. " +
         "Alle Eingaben müssen registriert, gleich beschnitten und gradientenkorrigiert sein.";
      main.add(intro);

      var sources = this.addGroup(main, "Master (2–4 Kanäle)");
      var ids = ["L", "R", "G", "B"];
      for (var i = 0; i < ids.length; ++i) this.addChannel(sources, ids[i]);

      var analysisRow = new HorizontalSizer;
      analysisRow.addStretch();
      this.analyzeButton = new PushButton(this);
      this.analyzeButton.text = "Analysieren";
      this.analyzeButton.onClick = () => this.analyze("");
      analysisRow.add(this.analyzeButton);
      sources.add(analysisRow);

      var mix = this.addGroup(main, "Mischung");
      var output = this.addGroup(main, "Ausgabe");

      var outRow = new HorizontalSizer;
      outRow.spacing = 6;
      var outLabel = new Label(this);
      outLabel.text = "Modus";
      outLabel.minWidth = 60;
      outRow.add(outLabel);
      this.outputMode = new ComboBox(this);
      this.outputMode.addItem("Als Datei speichern");
      this.outputMode.addItem("Als SLUM-Ansicht ausgeben");
      this.outputMode.currentItem = 0;
      this.outputMode.onItemSelected = () => this.outputModeChanged();
      outRow.add(this.outputMode, 100);

      var fileRow = new HorizontalSizer;
      fileRow.spacing = 6;
      var fileLabel = new Label(this);
      fileLabel.text = "XISF-Ziel";
      fileLabel.minWidth = 60;
      fileRow.add(fileLabel);
      this.outputFileLabel = fileLabel;
      this.outputEdit = new Edit(this);
      this.outputEdit.toolTip = "Neue .xisf-Datei; vorhandene Dateien werden nicht überschrieben.";
      this.outputEdit.onTextUpdated = () => {
         this.outputEdit.toolTip = this.outputEdit.text ||
            "Neue .xisf-Datei; vorhandene Dateien werden nicht überschrieben.";
         this.refreshSummary();
      };
      fileRow.add(this.outputEdit, 100);
      var outBrowse = new PushButton(this);
      outBrowse.text = "Wählen…";
      outBrowse.onClick = () => {
         var dialog = new SaveFileDialog;
         dialog.caption = "SLUM-XISF speichern";
         dialog.filters = [["PixInsight XISF", "*.xisf"]];
         dialog.overwritePrompt = true;
         if (dialog.execute()) {
            this.outputEdit.text = dialog.filePath;
            this.outputEdit.toolTip = dialog.filePath;
         }
         this.refreshSummary();
      };
      fileRow.add(outBrowse);
      this.outputBrowse = outBrowse;

      var methodRow = new HorizontalSizer;
      methodRow.spacing = 6;
      var methodLabel = new Label(this);
      methodLabel.text = "Normalisierung";
      methodLabel.minWidth = this.labelWidth;
      methodRow.add(methodLabel);
      this.methodCombo = new ComboBox(this);
      this.methodCombo.addItem("Verfahren wählen");
      this.methodCombo.addItem("SPFC-Flux (bevorzugt)");
      this.methodCombo.addItem("LinearFit verwenden (Fallback)");
      this.methodCombo.currentItem = 0;
      this.methodCombo.enabled = false;
      this.methodCombo.onItemSelected = index => {
         if (!this.suppress && this.analyzed) {
            if (index === 1 && !this.session.spfcAvailable) {
               this.suppress = true;
               this.methodCombo.currentItem = 0;
               this.suppress = false;
               this.session.selectMethod("");
               this.referenceCombo.enabled = false;
               this.status.text = "SPFC ist nicht für alle Kanäle gültig.";
               this.refreshSummary();
               return;
            }
            this.session.selectMethod(index === 1 ? "spfc" :
               index === 2 ? "linearFit" : "");
            this.referenceCombo.enabled = index === 2;
            this.refreshSummary();
         }
      };
      methodRow.add(this.methodCombo, 100);
      mix.add(methodRow);

      var refRow = new HorizontalSizer;
      refRow.spacing = 6;
      var refLabel = new Label(this);
      refLabel.text = "LinearFit-Referenz";
      refLabel.minWidth = this.labelWidth;
      refRow.add(refLabel);
      this.referenceCombo = new ComboBox(this);
      this.referenceCombo.addItem("Automatisch");
      this.referenceCombo.currentItem = 0;
      this.referenceCombo.enabled = false;
      this.referenceCombo.onItemSelected = index => {
         if (!this.suppress && this.analyzed) {
            this.referenceCombo.currentItem = index;
            this.session.selectReference(index === 0 ? this.session.recommended :
               this.session.rows[index - 1].id);
            this.refreshSummary();
         }
      };
      refRow.add(this.referenceCombo, 100);
      mix.add(refRow);

      this.lShare = new NumericControl(this);
      this.lShare.label.text = "L-Anteil an SLUM (%)";
      this.lShare.label.minWidth = this.labelWidth;
      this.lShare.setRange(20, 80);
      this.lShare.setPrecision(0);
      this.lShare.slider.setRange(20, 80);
      this.lShare.setValue(70);
      this.lShare.toolTip = "20 bis 80 % echte Luminanz; der Rest stammt aus RGBLUM.";
      this.lShare.visible = false;
      this.lShare.onValueUpdated = value => {
         if (!this.suppress && !this.busy) {
            this.session.setLuminanceFraction(value / 100);
            this.refreshSummary();
         }
      };
      mix.add(this.lShare);
      this.saturationBox = new CheckBox(this);
      this.saturationBox.text = "Gesättigte Sternränder korrigieren";
      this.saturationBox.checked = false;
      this.saturationBox.toolTip = "Senkt den L-Anteil nur in und um Pixel, in denen L gesättigt ist " +
         "(Sternkerne), auf " + Math.round(100 * SATURATION_TARGET) + " %. Aus = bisheriges Ergebnis.";
      this.saturationBox.visible = false;
      this.saturationBox.onClick = checked => {
         if (!this.suppress && !this.busy) this.session.setSaturationCorrection(checked);
      };
      var saturationRow = new HorizontalSizer;
      saturationRow.addUnscaledSpacing(this.labelWidth + 6);
      saturationRow.add(this.saturationBox);
      saturationRow.addStretch();
      this.saturationRow = saturationRow;
      mix.add(saturationRow);
      var weightModeRow = new HorizontalSizer;
      weightModeRow.spacing = 6;
      this.rgbWeightLabel = new Label(this);
      this.rgbWeightLabel.text = "RGB-Sampling-Gewichtung";
      this.rgbWeightLabel.minWidth = this.labelWidth;
      this.rgbWeightLabel.visible = false;
      weightModeRow.add(this.rgbWeightLabel);
      this.rgbMode = new ComboBox(this);
      this.rgbMode.addItem("Automatisch (Noise bei Ausgabe)");
      this.rgbMode.addItem("Manuell");
      this.rgbMode.currentItem = 0;
      this.rgbMode.visible = false;
      this.rgbMode.onItemSelected = index => {
         if (!this.suppress && this.analyzed && !this.busy) {
            this.rgbMode.currentItem = index;
            this.refreshWeightControls();
         }
      };
      weightModeRow.add(this.rgbMode, 100);
      mix.add(weightModeRow);
      this.rgbHint = new Label(this);
      this.rgbHint.visible = false;
      mix.add(this.rgbHint);
      var manualRow = new HorizontalSizer;
      manualRow.spacing = 10;
      for (var c of ["R", "G", "B"]) {
         var fieldLabel = new Label(this);
         fieldLabel.text = c + ":";
         fieldLabel.visible = false;
         manualRow.add(fieldLabel);
         var fieldEdit = new Edit(this);
         fieldEdit.setFixedWidth(56);
         fieldEdit.toolTip = "Gewicht innerhalb RGBLUM in Prozent (0 bis 100).";
         fieldEdit.visible = false;
         fieldEdit.onTextUpdated = () => this.refreshSummary();
         manualRow.add(fieldEdit);
         var computed = new Label(this);
         computed.visible = false;
         manualRow.add(computed);
         var percent = new Label(this);
         percent.text = "%";
         percent.visible = false;
         manualRow.add(percent);
         this.manualFields[c] = { label: fieldLabel, edit: fieldEdit,
            computed: computed, percent: percent };
      }
      manualRow.addStretch();
      mix.add(manualRow);
      output.add(outRow);
      output.add(fileRow);
      this.resultSummary = new Label(this);
      this.resultSummary.visible = false;
      output.add(this.resultSummary);

      this.report = new TextBox(this);
      this.report.readOnly = true;
      this.report.minHeight = 200;
      this.report.text = "Dateien oder geöffnete Ansichten wählen und Analysieren starten. Danach SPFC-Status, Verfahren und Sampling prüfen; Normalisierung und Noise laufen bei der Ausgabe.";
      main.add(this.report, 100);
      this.status = new Label(this);
      this.status.text = "Bereit";
      main.add(this.status);
      this.validation = new Label(this);
      this.validation.text = "Bilder wählen und analysieren.";
      main.add(this.validation);

      var buttons = new HorizontalSizer;
      buttons.spacing = 8;
      buttons.addStretch();
      this.saveButton = new PushButton(this);
      this.saveButton.text = "SLUM erstellen";
      this.saveButton.enabled = false;
      this.saveButton.onClick = () => this.create();
      buttons.add(this.saveButton);
      this.cancelButton = new PushButton(this);
      this.cancelButton.text = "Schließen";
      this.cancelButton.onClick = () => {
         if (this.busy) {
            this.cancelRequested = true;
            this.closeAfterCancel = true;
            this.status.text = "Abbruch angefordert…";
         } else {
            this.session.close();
            this.cancel();
         }
      };
      buttons.add(this.cancelButton);
      main.add(buttons);
      this.sizer = main;
      this.adjustToContents();
   }

   addGroup(main, title) {
      var box = new GroupBox(this);
      box.title = title;
      box.sizer = new VerticalSizer;
      box.sizer.margin = 8;
      box.sizer.spacing = 6;
      main.add(box);
      return box.sizer;
   }

   addChannel(main, id) {
      var row = new HorizontalSizer;
      row.spacing = 6;
      var label = new Label(this);
      label.text = id;
      label.minWidth = 60;
      row.add(label);
      var source = new ComboBox(this);
      source.addItem("Datei");
      source.addItem("Ansicht");
      source.currentItem = 0;
      source.toolTip = "Quelle für Kanal " + id + " wählen.";
      row.add(source);
      var path = new Edit(this);
      path.toolTip = id + "-Master (FITS oder XISF)";
      path.onTextUpdated = () => {
         path.toolTip = path.text || id + "-Master (FITS oder XISF)";
         if (source.currentItem === 0 && !this.suppress) {
            this.invalidate();
            sampling.text = "";
         }
      };
      row.add(path, 100);
      var browse = new PushButton(this);
      browse.text = "Wählen…";
      browse.onClick = () => {
         var dialog = new OpenFileDialog;
         dialog.caption = id + "-Master wählen";
         dialog.filters = [["Astrobilder", "*.fit *.fits *.xisf"], ["Alle Dateien", "*"]];
         if (dialog.execute()) {
            path.text = dialog.filePath;
            path.toolTip = dialog.filePath;
         }
      };
      row.add(browse);
      var viewList = new ViewList(this);
      viewList.toolTip = "Bereits geöffnete PixInsight-Hauptansicht für " + id + ".";
      viewList.getMainViews();
      viewList.visible = false;
      viewList.onViewSelected = () => {
         if (source.currentItem === 1 && !this.suppress) {
            this.invalidate();
            sampling.text = "";
         }
      };
      row.add(viewList, 100);
      var refresh = new PushButton(this);
      refresh.text = "Aktualisieren";
      refresh.toolTip = "Liste nach neu geöffneten Ansichten aktualisieren.";
      refresh.visible = false;
      refresh.onClick = () => {
         var previous = viewList.currentView;
         var previousId = previous && !previous.isNull ? previous.id : "";
         this.suppress = true;
         viewList.getMainViews();
         if (previousId) {
            var current = View.viewById(previousId);
            if (current && !current.isNull) viewList.currentView = current;
         }
         this.suppress = false;
         var chosen = viewList.currentView;
         var chosenId = chosen && !chosen.isNull ? chosen.id : "";
         if (source.currentItem === 1 && chosenId !== previousId) {
            this.invalidate();
            sampling.text = "";
         }
      };
      row.add(refresh);
      var samplingLabel = new Label(this);
      samplingLabel.text = "Sampling";
      row.add(samplingLabel);
      var sampling = new Edit(this);
      sampling.minWidth = 70;
      sampling.toolTip = "Natives Sampling/Binning, z. B. 1x1, 2x2 oder 3x3. Bei Resampling korrigieren.";
      sampling.onTextUpdated = () => this.refreshWeightControls();
      row.add(sampling);
      main.add(row);
      source.onItemSelected = index => {
         var isView = index === 1;
         this.invalidate();
         path.visible = !isView;
         browse.visible = !isView;
         viewList.visible = isView;
         refresh.visible = isView;
         if (isView) {
            this.suppress = true;
            viewList.getMainViews();
            this.suppress = false;
         }
         sampling.text = "";
         this.adjustToContents();
      };
      this.channels[id] = { source: source, path: path, browse: browse,
         viewList: viewList, refresh: refresh, sampling: sampling };
   }

   setInputsEnabled(enabled) {
      ["L", "R", "G", "B"].forEach(id => {
         var row = this.channels[id];
         row.source.enabled = enabled;
         row.path.enabled = enabled;
         row.browse.enabled = enabled;
         row.viewList.enabled = enabled;
         row.refresh.enabled = enabled;
         row.sampling.enabled = enabled;
      });
      this.outputEdit.enabled = enabled;
      this.outputBrowse.enabled = enabled;
      this.outputMode.enabled = enabled;
      this.rgbMode.enabled = enabled && this.analyzed;
      for (var id of ["R", "G", "B"])
         this.manualFields[id].edit.enabled = enabled && this.analyzed;
      this.lShare.enabled = enabled && this.analyzed;
      this.saturationBox.enabled = enabled && this.analyzed;
   }

   outputModeChanged() {
      var fileMode = this.outputMode.currentItem === 0;
      this.outputFileLabel.visible = fileMode;
      this.outputEdit.visible = fileMode;
      this.outputBrowse.visible = fileMode;
      this.adjustToContents();
      this.refreshSummary();
   }

   config() {
      var config = {};
      ["L", "R", "G", "B"].forEach(id => {
         var controls = this.channels[id];
         var isView = controls.source.currentItem === 1;
         var view = controls.viewList.currentView;
         config[id] = { source: isView ? "view" : "file",
            path: controls.path.text,
            viewId: isView && view && !view.isNull ? view.id : "",
            sampling: controls.sampling.text };
      });
      return config;
   }

   invalidate() {
      if (this.suppress) return;
      if (this.busy) { this.cancelRequested = true; return; }
      this.session.close();
      this.analyzed = false;
      this.lShare.visible = false;
      this.saturationBox.visible = false;
      this.hideWeightControls();
      this.methodCombo.enabled = false;
      this.referenceCombo.enabled = false;
      this.saveButton.enabled = false;
      this.report.text = "Dateiauswahl geändert. Bitte erneut analysieren.";
      this.status.text = "Analyse erforderlich";
      this.validation.text = "Bilder erneut analysieren.";
      this.resultSummary.visible = false;
   }

   analyze(override) {
      this.busy = true;
      this.cancelRequested = false;
      this.closeAfterCancel = false;
      this.analyzed = false;
      this.suppress = true;
      this.rgbMode.currentItem = 0;
      for (var color of ["R", "G", "B"])
         this.manualFields[color].edit.text = "";
      this.suppress = false;
      this.saveButton.enabled = false;
      this.resultSummary.visible = false;
      this.validation.text = "Analyse läuft…";
      this.analyzeButton.enabled = false;
      this.methodCombo.enabled = false;
      this.referenceCombo.enabled = false;
      this.setInputsEnabled(false);
      this.status.text = "Prüfe Eingaben und Median…";
      processEvents();
      try {
         var rows = this.session.analyze(this.config(), override, stage => this.progress(stage));
         this.analyzed = true;
         this.suppress = true;
         for (var i = 0; i < rows.length; ++i)
            if (!this.channels[rows[i].id].sampling.text)
               this.channels[rows[i].id].sampling.text = rows[i].sampling;
         this.referenceCombo.clear();
         this.referenceCombo.addItem("Automatisch: " + this.session.recommended);
         for (var j = 0; j < rows.length; ++j) this.referenceCombo.addItem(rows[j].id);
         this.referenceCombo.currentItem = override ?
            1 + rows.map(function(r){return r.id;}).indexOf(override) : 0;
         this.methodCombo.currentItem = this.session.spfcAvailable ? 1 : 0;
         this.methodCombo.enabled = true;
         this.referenceCombo.enabled = false;
         this.suppress = false;
         this.refreshWeightControls();
         this.adjustToContents();
         this.status.text = this.session.spfcAvailable ?
            "SPFC verfügbar. Sampling prüfen." :
            "SPFC unvollständig. LinearFit ausdrücklich wählen oder SPFC nachholen.";
      } catch (error) {
         this.session.close();
         this.suppress = false;
         this.analyzed = false;
         this.lShare.visible = false;
      this.saturationBox.visible = false;
         this.hideWeightControls();
         this.methodCombo.enabled = false;
         this.referenceCombo.enabled = false;
         var cancelled = error.message === "Vom Nutzer abgebrochen.";
         this.report.text = (cancelled ? "Analyse abgebrochen." :
            "Analyse fehlgeschlagen: " + error.message);
         this.status.text = cancelled ? "Abgebrochen" : "Fehler: " + error.message;
         this.validation.text = cancelled ? "Analyse abgebrochen." : "Analyse fehlgeschlagen: " + error.message;
      } finally {
         this.busy = false;
         this.analyzeButton.enabled = true;
         this.setInputsEnabled(true);
         if (this.analyzed) this.refreshSummary();
         if (this.closeAfterCancel) { this.session.close(); this.cancel(); }
      }
   }

   progress(stage) {
      this.status.text = stage;
      processEvents();
      if (this.cancelRequested) throw new Error("Vom Nutzer abgebrochen.");
   }

   hideWeightControls() {
      this.rgbWeightLabel.visible = false;
      this.rgbMode.visible = false;
      this.rgbHint.visible = false;
      for (var id of ["R", "G", "B"]) {
         var field = this.manualFields[id];
         field.label.visible = false;
         field.edit.visible = false;
         field.computed.visible = false;
         field.percent.visible = false;
      }
   }

   colorIds() {
      return this.session.rows.filter(function (row) { return row.id !== "L"; })
         .map(function (row) { return row.id; });
   }

   refreshWeightControls() {
      if (this.suppress || !this.analyzed) return;
      var colors = this.colorIds();
      var hasL = this.session.rows.some(function (row) { return row.id === "L"; });
      var manual = this.rgbMode.currentItem === 1 && colors.length > 1;
      this.lShare.visible = hasL;
      this.saturationBox.visible = hasL;
      this.rgbWeightLabel.visible = colors.length > 1;
      this.rgbMode.visible = colors.length > 1;
      this.rgbMode.toolTip = manual ?
         "Manuelle Gewichte gelten innerhalb RGBLUM und lassen den L-Anteil unverändert." :
         "Automatische RGB-Gewichte folgen dem Noise nach Normalisierung. Bei gemischtem Sampling ist das eine Heuristik.";
      this.rgbHint.visible = manual;
      if (manual)
         this.rgbHint.text = "RGB-Gewichte: erste Werte eingeben, letzter Kanal = Rest zu 100 %.";
      for (var id of ["R", "G", "B"]) {
         var field = this.manualFields[id];
         var selected = manual && colors.indexOf(id) >= 0;
         var last = selected && id === colors[colors.length - 1];
         field.label.visible = selected;
         field.edit.visible = selected && !last;
         field.computed.visible = last;
         field.percent.visible = selected && !last;
      }
      this.refreshSummary();
      this.adjustToContents();
   }

   manualWeights() {
      var colors = this.colorIds();
      if (this.rgbMode.currentItem !== 1 || colors.length < 2) return null;
      var weights = {};
      var used = 0;
      for (var i = 0; i < colors.length - 1; ++i) {
         var input = this.manualFields[colors[i]].edit.text.trim();
         if (!/^\d{1,3}$/.test(input))
            throw new Error("Gewicht für " + colors[i] + " als ganze Prozentzahl von 0 bis 100 eingeben.");
         var percent = Number(input);
         if (percent > 100)
            throw new Error("Gewicht für " + colors[i] + " muss zwischen 0 und 100 % liegen.");
         used += percent;
         weights[colors[i]] = percent / 100;
      }
      if (used > 100)
         throw new Error("RGB-Gewichte überschreiten zusammen 100 %.");
      weights[colors[colors.length - 1]] = (100 - used) / 100;
      return weights;
   }

   percentText(value) {
      return value.toFixed(2).replace(/\.00$/, "");
   }

   refreshSummary() {
      if (this.suppress || !this.analyzed) return;
      if (this.busy) { this.saveButton.enabled = false; return; }
      var hasL = this.session.rows.some(function (row) { return row.id === "L"; });
      var lines = ["Eingaben / Normalisierung / Ausgabe", ""];
      var sampling = {};
      for (var i = 0; i < this.session.rows.length; ++i) {
         var row = this.session.rows[i];
         sampling[row.id] = this.channels[row.id].sampling.text;
         lines.push(row.id + "  " + row.sourceLabel);
         lines.push("   Sampling " + sampling[row.id] + " (Header: " +
            (row.detectedSampling || "unbekannt") + ")  Median " +
            row.median.toPrecision(7));
         lines.push("   SPFC: " + (row.spfc.valid ?
            "gültig; Flux-Faktor " + row.spfc.scale.toPrecision(7) +
            ", Normierung " + row.spfc.normalization : row.spfc.reason));
      }
      lines.push("");
      if (!this.session.spfcAvailable)
         lines.push("SPFC außerhalb des Skripts nachholen, danach erneut analysieren; oder LinearFit als Fallback ausdrücklich wählen.");
      lines.push("Verfahren: " + (this.session.method === "spfc" ? "SPFC-Flux" :
         this.session.method === "linearFit" ? "LinearFit (Fallback)" : "noch nicht gewählt"));
      if (hasL)
         lines.push("Zwei Stufen: SLUM = " +
            (100 * this.session.lFraction).toFixed(0) + "% L + " +
            (100 * (1 - this.session.lFraction)).toFixed(0) + "% RGBLUM");
      if (this.session.method === "linearFit")
         lines.push("Referenzempfehlung: " + this.session.recommended +
            "   Gewählte Referenz: " + this.session.reference);
      if (!this.session.registrationCertain)
         lines.push("Hinweis: Nicht alle Eingaben haben eine WCS-Lösung; die Registrierung kann nicht geprüft werden und muss vorab sichergestellt sein.");
      var valid = true;
      var reason = "";
      var selectedColors = this.colorIds();
      if (this.rgbMode.currentItem === 1 && selectedColors.length > 1)
         this.manualFields[selectedColors[selectedColors.length - 1]].computed.text = "—";
      try {
         var manual = this.manualWeights();
         this.session.validateMix(sampling, manual);
         if (manual) {
            var ids = this.colorIds();
            this.manualFields[ids[ids.length - 1]].computed.text =
               (100 * manual[ids[ids.length - 1]]).toFixed(0) + " % (berechnet)";
            lines.push("Manuelle RGB-Anteile: " + ids.map(function (id) {
               return id + " " + (100 * manual[id]).toFixed(0) + "%";
            }).join("   "));
         }
      } catch (error) {
         valid = false;
         reason = error.message;
         lines.push("Noch erforderlich: " + error.message);
      }
      lines.push("Normalisierung, Noise, count und Endgewichte: werden bei der Ausgabe berechnet.");
      if (this.outputMode.currentItem === 0) {
         lines.push("Ausgabe: Datei " + this.outputEdit.text);
         if (!/\.xisf$/i.test(this.outputEdit.text.trim())) {
            valid = false;
            if (!reason) reason = "XISF-Ziel mit Endung .xisf wählen.";
         }
         if (this.outputEdit.text && File.exists(this.outputEdit.text.trim())) {
            valid = false;
            if (!reason) reason = "Ausgabedatei existiert bereits.";
            lines.push("Ausgabedatei existiert bereits.");
         }
      } else {
         lines.push("Ausgabe: neue SLUM-Ansicht in PixInsight (keine Datei)");
      }
      if (!this.session.method) {
         valid = false;
         reason = "SPFC vervollständigen oder LinearFit ausdrücklich wählen.";
      }
      this.report.text = lines.join("\n");
      this.saveButton.enabled = valid;
      this.validation.text = valid ? "Bereit zum Erstellen." : "Noch nötig: " + reason;
   }

   appendRunDetails() {
      var run = this.session.lastRun;
      var lines = ["", "Verfahren: " + (run.method === "spfc" ? "SPFC-Flux" : "LinearFit")];
      lines.push("RGB-Sampling-Gewichtung: " +
         (run.weightMode === "manual" ? "manuell" : "automatisch nach Noise"));
      if (run.method === "linearFit") lines.push("LinearFit-Referenz: " + run.reference);
      else lines.push("SPFC-Flux-Faktoren: " + run.rows.map(function (r) {
         return r.id + " " + r.spfc.scale.toPrecision(7);
      }).join("   "));
      lines.push("Noise nach Normalisierung:");
      for (var i = 0; i < run.rows.length; ++i) {
         var row = run.rows[i];
         var warning = countWarning(row.countPercent);
         lines.push(row.id + "  Noise " + row.noise.toPrecision(7) +
            "  count " + row.countPercent.toFixed(2) + "%" +
            (warning ? "  " + warning : ""));
      }
      if (run.lFraction !== null) {
         lines.push("RGBLUM intern: " + run.rgbWeights.map(function (w) {
            return w.id + " " + (100 * w.weight).toFixed(3) + "%";
         }).join("   "));
         lines.push("SLUM = " + (100 * run.lFraction).toFixed(0) + "% L + " +
            (100 * (1 - run.lFraction)).toFixed(0) + "% RGBLUM");
         lines.push("Sättigung erkannt: " +
            (run.saturation.channels.length ? run.saturation.channels.join(", ") : "keine"));
         lines.push("Sternrand-Korrektur: " + (!run.saturation.enabled ? "aus" :
            run.saturation.applied ? "ein (L-Anteil an gesättigten Sternen " +
               Math.round(100 * SATURATION_TARGET) + " %)" :
            "ein, aber L ist nicht gesättigt (keine Änderung)"));
      }
      lines.push("Endgewichte: " + run.weights.map(function(w) {
         return w.id + " " + (100 * w.weight).toFixed(3) + "%";
      }).join("   "));
      this.report.text += "\n" + lines.join("\n");
   }

   create() {
      this.busy = true;
      this.cancelRequested = false;
      this.closeAfterCancel = false;
      this.lastOutputViewId = "";
      this.saveButton.enabled = false;
      this.analyzeButton.enabled = false;
      this.methodCombo.enabled = false;
      this.cancelButton.text = "Abbrechen";
      this.setInputsEnabled(false);
      this.status.text = "Erzeuge SLUM…";
      this.validation.text = "SLUM wird berechnet…";
      processEvents();
      try {
         var sampling = {};
         for (var i = 0; i < this.session.rows.length; ++i) {
            var id = this.session.rows[i].id;
            sampling[id] = this.channels[id].sampling.text;
         }
         if (this.outputMode.currentItem === 0) {
            this.session.create(this.outputEdit.text.trim(), sampling, this.manualWeights(),
               stage => this.progress(stage));
            this.report.text += "\n\nFertig: " + this.outputEdit.text.trim();
            this.status.text = "SLUM-Datei gespeichert.";
         } else {
            var result = this.session.createView(sampling, this.manualWeights(),
               stage => this.progress(stage));
            this.lastOutputViewId = result.viewId;
            this.report.text += "\n\nFertig: SLUM-Ansicht " + result.viewId;
            this.status.text = "SLUM-Ansicht ausgegeben: " + result.viewId;
         }
         this.appendRunDetails();
         var run = this.session.lastRun;
         this.resultSummary.text = "SLUM erstellt: " + run.weights.map(function (w) {
            return w.id + " " + (100 * w.weight).toFixed(1) + "%";
         }).join("   ") + "   ·   " +
            (this.lastOutputViewId ? "Ansicht " + this.lastOutputViewId :
               this.outputEdit.text.trim().replace(/^.*[\\/]/, ""));
         this.resultSummary.toolTip = this.lastOutputViewId ?
            "Ansicht " + this.lastOutputViewId : this.outputEdit.text.trim();
         this.resultSummary.visible = true;
         this.adjustToContents();
         this.validation.text = "SLUM erfolgreich erstellt.";
         this.analyzed = false;
         this.methodCombo.enabled = false;
         this.referenceCombo.enabled = false;
      } catch (error) {
         this.session.close();
         this.analyzed = false;
         this.methodCombo.enabled = false;
         var cancelled = error.message === "Vom Nutzer abgebrochen.";
         this.report.text += cancelled ? "\n\nErstellung abgebrochen." :
            "\n\nFehler: " + error.message;
         this.status.text = cancelled ? "Abgebrochen" : "Fehler: " + error.message;
         this.validation.text = cancelled ? "Erstellung abgebrochen." : "Fehler: " + error.message;
      } finally {
         this.busy = false;
         this.cancelButton.text = "Schließen";
         this.analyzeButton.enabled = true;
         this.setInputsEnabled(true);
         if (this.closeAfterCancel) this.cancel();
      }
   }
}
