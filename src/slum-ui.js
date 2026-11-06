// Native PixInsight dialog. Analysis stays in memory until Save or Cancel.
class SlumDialog extends Dialog {
   constructor() {
      super();
      this.windowTitle = "SLUM – Super-Luminanz";
      this.userResizable = true;
      this.session = new SlumSession;
      this.analyzed = false;
      this.suppress = false;
      this.channels = {};
      this.shareRows = [];
      this.groupNames = [];

      var main = new VerticalSizer;
      main.margin = 12;
      main.spacing = 8;
      var intro = new Label(this);
      intro.useRichText = true;
      intro.text = "<b>SLUM aus 2–4 linearen Monochrom-Mastern</b><br/>" +
         "Alle Eingaben müssen registriert, gleich beschnitten und gradientenkorrigiert sein.";
      main.add(intro);

      var ids = ["L", "R", "G", "B"];
      for (var i = 0; i < ids.length; ++i) this.addChannel(main, ids[i]);

      var outRow = new HorizontalSizer;
      outRow.spacing = 6;
      var outLabel = new Label(this);
      outLabel.text = "SLUM-Ziel";
      outLabel.minWidth = 60;
      outRow.add(outLabel);
      this.outputEdit = new Edit(this);
      this.outputEdit.toolTip = "Neue .xisf-Datei; vorhandene Dateien werden nicht überschrieben.";
      this.outputEdit.onTextUpdated = () => this.refreshSummary();
      outRow.add(this.outputEdit, 100);
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
      outRow.add(outBrowse);
      main.add(outRow);

      var refRow = new HorizontalSizer;
      refRow.spacing = 6;
      var refLabel = new Label(this);
      refLabel.text = "LinearFit-Referenz";
      refRow.add(refLabel);
      this.referenceCombo = new ComboBox(this);
      this.referenceCombo.addItem("Automatisch: niedrigster Median");
      this.referenceCombo.currentItem = 0;
      this.referenceCombo.enabled = false;
      this.referenceCombo.onItemSelected = index => {
         if (!this.suppress && this.analyzed) this.analyze(index === 0 ? "" : this.session.rows[index - 1].id);
      };
      refRow.add(this.referenceCombo, 100);
      this.analyzeButton = new PushButton(this);
      this.analyzeButton.text = "Analysieren";
      this.analyzeButton.onClick = () => this.analyze("");
      refRow.add(this.analyzeButton);
      main.add(refRow);

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
      this.registration.text = "Gleiches registriertes Ausgaberaster trotz fehlender WCS-Daten bestätigt";
      this.registration.visible = false;
      this.registration.onCheck = () => this.refreshSummary();
      main.add(this.registration);

      this.report = new TextBox(this);
      this.report.readOnly = true;
      this.report.minHeight = 220;
      this.report.text = "Dateien wählen und Analysieren starten. Danach Referenz, Sampling und Gewichte prüfen.";
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
      cancelButton.onClick = () => { this.session.close(); this.cancel(); };
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
      var path = new Edit(this);
      path.toolTip = id + "-Master (FITS oder XISF)";
      path.onTextUpdated = () => this.invalidate();
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
      var sampling = new Edit(this);
      sampling.minWidth = 70;
      sampling.toolTip = "Natives Sampling, z. B. 1x1 oder 2x2. Bei Resampling korrigieren.";
      sampling.onTextUpdated = () => this.refreshGroups();
      row.add(sampling);
      main.add(row);
      this.channels[id] = { path: path, sampling: sampling };
   }

   config() {
      var config = {};
      ["L", "R", "G", "B"].forEach(id => {
         config[id] = { path: this.channels[id].path.text,
            sampling: this.channels[id].sampling.text };
      });
      return config;
   }

   invalidate() {
      if (this.suppress) return;
      this.session.close();
      this.analyzed = false;
      this.referenceCombo.enabled = false;
      this.saveButton.enabled = false;
      this.report.text = "Dateiauswahl geändert. Bitte erneut analysieren.";
      this.status.text = "Analyse erforderlich";
   }

   analyze(override) {
      this.saveButton.enabled = false;
      this.status.text = "Analysiere Bilder und LinearFit…";
      processEvents();
      try {
         var rows = this.session.analyze(this.config(), override);
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
         this.referenceCombo.enabled = true;
         this.suppress = false;
         this.registration.visible = !this.session.registrationCertain;
         this.refreshGroups();
         this.adjustToContents();
         this.status.text = "Analyse abgeschlossen. Werte prüfen und SLUM erstellen.";
      } catch (error) {
         this.suppress = false;
         this.analyzed = false;
         this.referenceCombo.enabled = false;
         this.report.text = "Analyse fehlgeschlagen: " + error.message;
         this.status.text = "Fehler: " + error.message;
      }
   }

   refreshGroups() {
      if (this.suppress || !this.analyzed) return;
      var groups = [];
      for (var i = 0; i < this.session.rows.length; ++i) {
         var row = this.session.rows[i];
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
      var lines = ["Eingaben / Statistik / Gewichte", ""];
      var sampling = {};
      for (var i = 0; i < this.session.rows.length; ++i) {
         var row = this.session.rows[i];
         sampling[row.id] = this.channels[row.id].sampling.text;
         var warningText = countWarning(row.countPercent);
         var warning = warningText ? "  " + warningText : "";
         lines.push(row.id + "  " + row.path);
         lines.push("   Sampling " + sampling[row.id] + " (Header: " +
            (row.detectedSampling || "unbekannt") + ")  Median " +
            row.median.toPrecision(7) + "  Noise " + row.noise.toPrecision(7) +
            "  count " + row.countPercent.toFixed(2) + "%" + warning);
      }
      lines.push("");
      lines.push("Referenzempfehlung: " + this.session.recommended +
         "   Gewählte Referenz: " + this.session.reference);
      if (!this.session.registrationCertain)
         lines.push("WCS unvollständig oder unterschiedlich: Rasterbestätigung erforderlich.");
      var valid = true;
      try {
         var shares = this.shares();
         var weights = this.session.weights(sampling, shares);
         if (this.groupNames.length > 1)
            for (var g = 0; g < this.groupNames.length; ++g)
               lines.push("Gruppe " + this.groupNames[g] + ": " +
                  (shares[this.groupNames[g]] * 100).toFixed(2) + "%");
         lines.push("Endgewichte: " + weights.map(function(w){
            return w.id + " " + (100 * w.weight).toFixed(3) + "%";
         }).join("   "));
      } catch (error) { valid = false; lines.push("Noch erforderlich: " + error.message); }
      lines.push("Ausgabe: " + this.outputEdit.text);
      if (!/\.xisf$/i.test(this.outputEdit.text.trim())) valid = false;
      if (this.outputEdit.text && File.exists(this.outputEdit.text.trim())) {
         valid = false;
         lines.push("Ausgabedatei existiert bereits.");
      }
      if (!this.prerequisite.checked) valid = false;
      if (!this.session.registrationCertain && !this.registration.checked) valid = false;
      this.report.text = lines.join("\n");
      this.saveButton.enabled = valid;
   }

   create() {
      this.saveButton.enabled = false;
      this.status.text = "Erzeuge SLUM…";
      processEvents();
      try {
         var sampling = {};
         for (var i = 0; i < this.session.rows.length; ++i) {
            var id = this.session.rows[i].id;
            sampling[id] = this.channels[id].sampling.text;
         }
         this.session.create(this.outputEdit.text.trim(), sampling, this.shares(),
            this.session.registrationCertain || this.registration.checked);
         this.analyzed = false;
         this.referenceCombo.enabled = false;
         this.report.text += "\n\nFertig: " + this.outputEdit.text.trim();
         this.status.text = "SLUM gespeichert.";
      } catch (error) {
         this.session.close();
         this.analyzed = false;
         this.report.text += "\n\nFehler: " + error.message;
         this.status.text = "Fehler: " + error.message;
      }
   }
}
