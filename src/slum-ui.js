// Native PixInsight dialog. Analysis stays in memory until output or cancel.
class SlumDialog extends Dialog {
   constructor() {
      super();
      this.windowTitle = "SLUM – Super-Luminanz";
      this.userResizable = true;
      this.minWidth = 760;
      this.session = new SlumSession;
      this.analyzed = false;
      this.suppress = false;
      this.channels = {};
      this.shareRows = [];
      this.groupNames = [];
      this.busy = false;
      this.cancelRequested = false;
      this.closeAfterCancel = false;
      this.lastOutputViewId = "";

      var main = new VerticalSizer;
      main.margin = 12;
      main.spacing = 8;
      var intro = new Label(this);
      intro.useRichText = true;
      intro.text = "<b>SLUM aus 2–4 linearen Monochrom-Mastern</b><br/>" +
         "Je Kanal eine Datei oder eine geöffnete Hauptansicht wählen. " +
         "Alle Eingaben müssen registriert, gleich beschnitten und gradientenkorrigiert sein.";
      main.add(intro);

      var ids = ["L", "R", "G", "B"];
      for (var i = 0; i < ids.length; ++i) this.addChannel(main, ids[i]);

      var outRow = new HorizontalSizer;
      outRow.spacing = 6;
      var outLabel = new Label(this);
      outLabel.text = "Ausgabe";
      outLabel.minWidth = 60;
      outRow.add(outLabel);
      this.outputMode = new ComboBox(this);
      this.outputMode.addItem("Als Datei speichern");
      this.outputMode.addItem("Als SLUM-Ansicht ausgeben");
      this.outputMode.currentItem = 0;
      this.outputMode.onItemSelected = () => this.outputModeChanged();
      outRow.add(this.outputMode, 100);
      main.add(outRow);

      var fileRow = new HorizontalSizer;
      fileRow.spacing = 6;
      var fileLabel = new Label(this);
      fileLabel.text = "XISF-Ziel";
      fileLabel.minWidth = 60;
      fileRow.add(fileLabel);
      this.outputFileLabel = fileLabel;
      this.outputEdit = new Edit(this);
      this.outputEdit.toolTip = "Neue .xisf-Datei; vorhandene Dateien werden nicht überschrieben.";
      this.outputEdit.onTextUpdated = () => this.refreshSummary();
      fileRow.add(this.outputEdit, 100);
      var outBrowse = new PushButton(this);
      outBrowse.text = "Wählen…";
      outBrowse.onClick = () => {
         var dialog = new SaveFileDialog;
         dialog.caption = "SLUM-XISF speichern";
         dialog.filters = [["PixInsight XISF", "*.xisf"]];
         dialog.overwritePrompt = true;
         if (dialog.execute()) this.outputEdit.text = dialog.filePath;
         this.refreshSummary();
      };
      fileRow.add(outBrowse);
      this.outputBrowse = outBrowse;
      main.add(fileRow);

      var methodRow = new HorizontalSizer;
      methodRow.spacing = 6;
      var methodLabel = new Label(this);
      methodLabel.text = "Normalisierung";
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
      main.add(methodRow);

      var refRow = new HorizontalSizer;
      refRow.spacing = 6;
      var refLabel = new Label(this);
      refLabel.text = "LinearFit-Referenz";
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
      this.analyzeButton = new PushButton(this);
      this.analyzeButton.text = "Analysieren";
      this.analyzeButton.onClick = () => this.analyze("");
      refRow.add(this.analyzeButton);
      main.add(refRow);

      this.lShare = new NumericControl(this);
      this.lShare.label.text = "L-Anteil an SLUM (%)";
      this.lShare.setRange(50, 80);
      this.lShare.setPrecision(0);
      this.lShare.slider.setRange(50, 80);
      this.lShare.setValue(70);
      this.lShare.toolTip = "50 bis 80 % echte Luminanz; der Rest stammt aus RGBLUM.";
      this.lShare.visible = false;
      this.lShare.onValueUpdated = value => {
         if (!this.suppress && !this.busy) {
            this.session.setLuminanceFraction(value / 100);
            this.refreshSummary();
         }
      };
      main.add(this.lShare);
      this.lShareHint = new Label(this);
      this.lShareHint.text = "RGBLUM erhält den Rest; R/G/B werden darin nach Noise gewichtet.";
      this.lShareHint.visible = false;
      main.add(this.lShareHint);

      this.shareLabel = new Label(this);
      this.shareLabel.text = "Anteile der Sampling-Gruppen (zusammen 100 %)";
      this.shareLabel.visible = false;
      main.add(this.shareLabel);
      for (var s = 0; s < 4; ++s) {
         var shareSizer = new HorizontalSizer;
         shareSizer.spacing = 6;
         var groupLabel = new Label(this);
         groupLabel.minWidth = 90;
         shareSizer.add(groupLabel);
         var shareEdit = new Edit(this);
         shareEdit.toolTip = "Anteil in Prozent, zum Beispiel 70";
         shareEdit.onTextUpdated = () => this.refreshSummary();
         shareSizer.add(shareEdit, 100);
         var percent = new Label(this);
         percent.text = "%";
         shareSizer.add(percent);
         groupLabel.visible = false;
         shareEdit.visible = false;
         percent.visible = false;
         main.add(shareSizer);
         this.shareRows.push({ label: groupLabel, edit: shareEdit, percent: percent });
      }

      this.prerequisite = new CheckBox(this);
      this.prerequisite.text = "Linearität, Registrierung, gleichen Ausschnitt und Gradientenkorrektur bestätigt";
      this.prerequisite.onCheck = () => this.refreshSummary();
      main.add(this.prerequisite);
      this.registration = new CheckBox(this);
      this.registration.text = "Gleiches registriertes Ausgaberaster trotz unsicherer WCS-Daten bestätigt";
      this.registration.visible = false;
      this.registration.onCheck = () => this.refreshSummary();
      main.add(this.registration);

      this.report = new TextBox(this);
      this.report.readOnly = true;
      this.report.minHeight = 260;
      this.report.text = "Dateien oder geöffnete Ansichten wählen und Analysieren starten. Danach SPFC-Status, Verfahren und Sampling prüfen; Normalisierung und Noise laufen bei der Ausgabe.";
      main.add(this.report, 100);
      this.status = new Label(this);
      this.status.text = "Bereit";
      main.add(this.status);

      var buttons = new HorizontalSizer;
      buttons.spacing = 8;
      buttons.addStretch();
      this.saveButton = new PushButton(this);
      this.saveButton.text = "SLUM erstellen";
      this.saveButton.enabled = false;
      this.saveButton.onClick = () => this.create();
      buttons.add(this.saveButton);
      var cancelButton = new PushButton(this);
      cancelButton.text = "Schließen";
      cancelButton.onClick = () => {
         if (this.busy) {
            this.cancelRequested = true;
            this.closeAfterCancel = true;
            this.status.text = "Abbruch angefordert…";
         } else {
            this.session.close();
            this.cancel();
         }
      };
      buttons.add(cancelButton);
      main.add(buttons);
      this.sizer = main;
      this.adjustToContents();
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
         if (dialog.execute()) path.text = dialog.filePath;
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
      refresh.text = "↻";
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
      sampling.toolTip = "Natives Sampling, z. B. 1x1 oder 2x2. Bei Resampling korrigieren.";
      sampling.onTextUpdated = () => this.refreshGroups();
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
      this.prerequisite.enabled = enabled;
      this.registration.enabled = enabled;
      for (var i = 0; i < this.shareRows.length; ++i)
         this.shareRows[i].edit.enabled = enabled;
      this.lShare.enabled = enabled && this.analyzed;
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
      this.lShareHint.visible = false;
      this.methodCombo.enabled = false;
      this.referenceCombo.enabled = false;
      this.saveButton.enabled = false;
      this.report.text = "Dateiauswahl geändert. Bitte erneut analysieren.";
      this.status.text = "Analyse erforderlich";
   }

   analyze(override) {
      this.busy = true;
      this.cancelRequested = false;
      this.closeAfterCancel = false;
      this.analyzed = false;
      this.groupNames = [];
      this.saveButton.enabled = false;
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
         this.registration.visible = !this.session.registrationCertain;
         this.refreshGroups();
         this.adjustToContents();
         this.status.text = this.session.spfcAvailable ?
            "SPFC verfügbar. Sampling prüfen." :
            "SPFC unvollständig. LinearFit ausdrücklich wählen oder SPFC nachholen.";
      } catch (error) {
         this.session.close();
         this.suppress = false;
         this.analyzed = false;
         this.lShare.visible = false;
         this.lShareHint.visible = false;
         this.methodCombo.enabled = false;
         this.referenceCombo.enabled = false;
         var cancelled = error.message === "Vom Nutzer abgebrochen.";
         this.report.text = (cancelled ? "Analyse abgebrochen." :
            "Analyse fehlgeschlagen: " + error.message);
         this.status.text = cancelled ? "Abgebrochen" : "Fehler: " + error.message;
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

   refreshGroups() {
      if (this.suppress || !this.analyzed) return;
      var hasL = this.session.rows.some(function (row) { return row.id === "L"; });
      this.lShare.visible = hasL;
      this.lShareHint.visible = hasL;
      var groups = [];
      for (var i = 0; i < this.session.rows.length; ++i) {
         var row = this.session.rows[i];
         if (hasL && row.id === "L") continue;
         var value = this.channels[row.id].sampling.text;
         try {
            var key = samplingKey(value);
            if (groups.indexOf(key) < 0) groups.push(key);
         } catch (_) { /* Error is shown in summary. */ }
      }
      var old = {};
      for (var k = 0; k < this.groupNames.length; ++k)
         old[this.groupNames[k]] = this.shareRows[k].edit.text;
      this.groupNames = groups;
      this.shareLabel.text = hasL ? "Anteile innerhalb RGBLUM (zusammen 100 %)" :
         "Anteile der Sampling-Gruppen (zusammen 100 %)";
      this.shareLabel.visible = groups.length > 1;
      for (var j = 0; j < this.shareRows.length; ++j) {
         var visible = groups.length > 1 && j < groups.length;
         var item = this.shareRows[j];
         item.label.visible = visible;
         item.edit.visible = visible;
         item.percent.visible = visible;
         item.label.text = visible ? groups[j] : "";
         this.suppress = true;
         item.edit.text = visible ? (old[groups[j]] || "") : "";
         this.suppress = false;
      }
      this.refreshSummary();
   }

   shares() {
      if (this.groupNames.length <= 1) return null;
      var shares = {};
      for (var i = 0; i < this.groupNames.length; ++i) {
         var text = this.shareRows[i].edit.text.trim().replace(",", ".");
         if (!text || !/^\d+(?:\.\d+)?$/.test(text))
            throw new Error("Bitte Anteil für " + this.groupNames[i] + " eingeben.");
         shares[this.groupNames[i]] = Number(text) / 100;
      }
      return shares;
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
         lines.push("Zwei Stufen: RGBLUM aus R/G/B nach Noise; SLUM = " +
            (100 * this.session.lFraction).toFixed(0) + "% L + " +
            (100 * (1 - this.session.lFraction)).toFixed(0) + "% RGBLUM");
      if (this.session.method === "linearFit")
         lines.push("Referenzempfehlung: " + this.session.recommended +
            "   Gewählte Referenz: " + this.session.reference);
      if (!this.session.registrationCertain)
         lines.push("Registriertes Ausgaberaster anhand der WCS nicht sicher: Bestätigung erforderlich.");
      var valid = true;
      try {
         var shares = this.shares();
         this.session.validateMix(sampling, shares);
         if (this.groupNames.length > 1)
            for (var g = 0; g < this.groupNames.length; ++g)
               lines.push((hasL ? "RGBLUM-Gruppe " : "Gruppe ") +
                  this.groupNames[g] + ": " +
                  (shares[this.groupNames[g]] * 100).toFixed(2) + "%");
      } catch (error) { valid = false; lines.push("Noch erforderlich: " + error.message); }
      lines.push("Normalisierung, Noise, count und Endgewichte: werden bei der Ausgabe berechnet.");
      if (this.outputMode.currentItem === 0) {
         lines.push("Ausgabe: Datei " + this.outputEdit.text);
         if (!/\.xisf$/i.test(this.outputEdit.text.trim())) valid = false;
         if (this.outputEdit.text && File.exists(this.outputEdit.text.trim())) {
            valid = false;
            lines.push("Ausgabedatei existiert bereits.");
         }
      } else {
         lines.push("Ausgabe: neue SLUM-Ansicht in PixInsight (keine Datei)");
      }
      if (!this.prerequisite.checked) valid = false;
      if (!this.session.method) valid = false;
      if (!this.session.registrationCertain && !this.registration.checked) valid = false;
      this.report.text = lines.join("\n");
      this.saveButton.enabled = valid;
   }

   appendRunDetails() {
      var run = this.session.lastRun;
      var lines = ["", "Verfahren: " + (run.method === "spfc" ? "SPFC-Flux" : "LinearFit")];
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
      this.setInputsEnabled(false);
      this.status.text = "Erzeuge SLUM…";
      processEvents();
      try {
         var sampling = {};
         for (var i = 0; i < this.session.rows.length; ++i) {
            var id = this.session.rows[i].id;
            sampling[id] = this.channels[id].sampling.text;
         }
         if (this.outputMode.currentItem === 0) {
            this.session.create(this.outputEdit.text.trim(), sampling, this.shares(),
               this.session.registrationCertain || this.registration.checked,
               stage => this.progress(stage));
            this.report.text += "\n\nFertig: " + this.outputEdit.text.trim();
            this.status.text = "SLUM-Datei gespeichert.";
         } else {
            var result = this.session.createView(sampling, this.shares(),
               this.session.registrationCertain || this.registration.checked,
               stage => this.progress(stage));
            this.lastOutputViewId = result.viewId;
            this.report.text += "\n\nFertig: SLUM-Ansicht " + result.viewId;
            this.status.text = "SLUM-Ansicht ausgegeben: " + result.viewId;
         }
         this.appendRunDetails();
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
      } finally {
         this.busy = false;
         this.analyzeButton.enabled = true;
         this.setInputsEnabled(true);
         if (this.closeAfterCancel) this.cancel();
      }
   }
}
