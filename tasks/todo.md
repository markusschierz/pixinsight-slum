# Aufgabenliste: PixInsight SLUM

**Status:** Freigegeben am 6. November 2026; Aufgaben 1–8 sowie die ergänzte Quellenauswahl implementiert und geprüft. Aufgabe 9 wartet nur auf die manuelle Tastaturnavigation. [Abnahmeprotokoll](../docs/acceptance.md).

**Basis:** [freigegebene SPEC](../SPEC.md), [freigegebener Plan](plan.md), [führendes Issue #1](https://github.com/markusschierz/pixinsight-slum/issues/1).

**Regel:** Alle Aufgaben gehören zu Issue #1. Die PR-Grenzen entsprechen dem Plan; es werden keine Unter-Issues angelegt. Dateinamen unten bezeichnen geplante Komponenten und werden beim PJSR-API-Abgleich präzisiert.

## PR 1 – Laufzeit und Rechenkern

### Aufgabe 1: PJSR-Schnittstellen prüfen

- [x] PixInsight-Version und die benötigten APIs für Bildöffnung, Kopie, Statistik, LinearFit, Noise, PixelMath, XISF und Cleanup anhand der lokalen Installation festhalten.
- **Abnahme:** Ein kleiner Lauf in PixInsight bestätigt die gewählten Schnittstellen, ohne Eingabebilder zu verändern.
- **Prüfung:** Version und API-Ergebnis mit den mitgelieferten Skripten abgleichen.
- **Betroffen:** Laufzeitprobe, Skripteinstieg, kurze Entwicklernotiz. **Abhängigkeit:** keine.

### Aufgabe 2: Median und Noise aus endgültigen Bildversionen bestimmen

- [x] Gültige gemeinsame Pixel für Median/Referenzempfehlung bestimmen; eine Noise-Funktion bereitstellen, die später auf den Fit-Ergebnissen und der Referenzansicht läuft.
- **Abnahme:** Ungültige Pixel beeinflussen den Median nicht; Noise-Werte bleiben endlich und positiv.
- **Prüfung:** Median mit PixInsight Statistics und Noise/`count(%)` mit dem installierten NoiseEvaluation-Skript auf denselben Bildern vergleichen.
- **Betroffen:** Statistik-/Noise-Komponente, fokussierte Tests. **Abhängigkeit:** 1.

### Aufgabe 3: Gewichte unabhängig vom Dialog berechnen

- [x] Inverse Varianzgewichte für eine Gruppe und Kanalgewichte aus mehreren Gruppen mit bestätigten Anteilen berechnen.
- **Abnahme:** Alle gültigen Endgewichte summieren sich zu 1; Null-, NaN- und ungültige Gruppenanteile werden abgewiesen.
- **Prüfung:** Beispiele aus dem Workflow und gezielte Grenzfälle unabhängig nachrechnen.
- **Betroffen:** Rechenkern, fokussierte Tests. **Abhängigkeit:** 1.

**Checkpoint A:** PixInsight-APIs sind bestätigt; Statistik und Gewichte bestehen den Abgleich. Erst dann beginnt der erste Dateilauf.

## PR 2 – Erster vollständiger Lauf

### Aufgabe 4: Zwei Dateien sicher einlesen

- [x] Zwei Monochrom-Dateien auswählen, Größe und gemeinsames Raster prüfen und temporäre Arbeitsansichten erstellen.
- **Abnahme:** Eingabedateien und geöffnete Originalansichten werden nie bearbeitet; doppelte oder unpassende Dateien werden abgewiesen.
- **Prüfung:** Vorher/nachher-Dateivergleich, Ansichtskontrolle und Fehlerfälle für eine/eine doppelte Datei sowie verschiedene Maße.
- **Betroffen:** nativer Dialog, Eingabeprüfung, Bildlebenszyklus. **Abhängigkeit:** 1.

### Aufgabe 5: Zwei-Kanal-SLUM erzeugen

- [x] Referenz wählen, andere Arbeitsansicht fitten, Noise neu messen, PixelMath ohne Rescaling ausführen und eine 32-Bit-Graustufen-XISF speichern.
- **Abnahme:** Genau eine neue SLUM-Datei bleibt; temporäre Ansichten werden nach Erfolg und Fehler geschlossen.
- **Prüfung:** Datei in PixInsight öffnen, Pixelstichproben/Endgewichte nachrechnen, Originale und Ausgabeverzeichnis vergleichen.
- **Betroffen:** Fit-Orchestrierung, Ausgabe, Dialogstatus, Integrationstest. **Abhängigkeit:** 2, 3, 4.

**Checkpoint B:** Der Zwei-Kanal-Pfad funktioniert durchgängig und erhält alle Originale.

## PR 3 – Kanalvarianten und Referenzwahl

### Aufgabe 6: LRGB, Teilmengen und Override ergänzen

- [x] Zwei bis vier ausgewählte Kanäle einschließlich RGB ohne L verarbeiten; Medianempfehlung und manuelle Referenzwahl getrennt anzeigen.
- **Abnahme:** Ein Referenzwechsel löst Fit und Noise-Messung neu aus; veraltete Werte können nicht gespeichert werden.
- **Prüfung:** LRGB, RGB und eine Zwei-Kanal-Teilmenge mit und ohne Override in PixInsight ausführen.
- **Betroffen:** Dialogzustand, Auswahlvalidierung, Fit-Orchestrierung, Integrationstest. **Abhängigkeit:** 5.

## PR 4 – Gemischtes Binning

### Aufgabe 7: Sampling-Gruppen und Anteile ergänzen

- [x] Ursprüngliches Sampling je Kanal anzeigen/korrigieren, Gruppen bilden und ausdrücklich bestätigte Anteile anwenden.
- **Abnahme:** Noise wird nur innerhalb einer Gruppe verglichen; fehlende Sampling-Werte oder Anteile ungleich 100 % blockieren die Ausgabe.
- **Prüfung:** Gezielter 1×1/2×2-Testfall auf gemeinsamem Raster; interne und endgültige Gewichte unabhängig nachrechnen.
- **Betroffen:** Eingabeprüfung, Gruppengewichtung, Dialog, Integrationstest. **Abhängigkeit:** 6.

**Checkpoint C:** Gleiches und gemischtes Sampling sowie alle Kanal-Teilmengen funktionieren.

## PR 5 – Fehlerpfade und Abnahme

### Aufgabe 8: Warnungen, Abbruch und Cleanup absichern

- [x] `count(%)`-Warnstufen, Geometriefehler, ungültiges Noise, Speicherkonflikt, Abbruch und Fehlerbereinigung fertigstellen.
- **Abnahme:** Jeder Fehler nennt eine konkrete Ursache; ohne Erfolg gibt es keine SLUM- oder Restdatei und keine Änderung an Originalen.
- **Prüfung:** Fehlerfälle der SPEC gezielt auslösen; Eingabe-Hashes, Originalansichten und temporäre Ansichten prüfen.
- **Betroffen:** Fehlerbehandlung, Dialogzustände, Bild-/Dateilebenszyklus, Regressionstests. **Abhängigkeit:** 7.

### Aufgabe 9: End-to-End-Abnahme dokumentieren

- [x] Lokalen LRGB- und RGB-Datensatz sowie den gezielten Misch-Binning-Testfall gegen die fachlichen SPEC-Kriterien prüfen.
- [ ] Tab-Reihenfolge in einer interaktiven PixInsight-Sitzung manuell prüfen.
- **Abnahme:** Nur SLUM entsteht; Gewichtung, Referenz, Ausgabeformat und Originalschutz sind für alle drei Fälle nachgewiesen.
- **Prüfung:** PixInsight-Durchlauf, Pixelstichproben, Dateivergleich und Tastatur-/Fehlerzustände des Dialogs.
- **Betroffen:** Abnahmeprotokoll, gegebenenfalls fokussierte Testkorrekturen. **Abhängigkeit:** 8.

**Checkpoint D:** Alle Akzeptanzkriterien der SPEC sind erfüllt. Danach kann die Implementierung zur Gesamtabnahme vorgelegt werden.

## PR 6 – Dateien und geöffnete Ansichten als Quellen

Die spätere Nutzerergänzung erweitert die Quellenauswahl innerhalb des führenden Issues #1, ohne ein neues Issue anzulegen.

- [x] Je Kanal Datei oder bereits geöffnete PixInsight-Hauptansicht wählen; Datei- und Ansichtsquellen mischen.
- [x] Aktuelle Ansichts-Pixel in temporäre Arbeitsbilder kopieren, ohne die Originalansicht zu bearbeiten oder zu schließen.
- [x] Doppelte Ansichts-IDs sowie dieselbe Quelldatei als Datei und Ansicht abweisen; Quellenwechsel verwirft alte Analysewerte.
- **Prüfung:** Node-Eingabeprüfung, native Datei-/Ansichts- und reine Ansichtsprobe, Dialogprobe mit Ansichtswechsel, Pixel-/`isModified`-Vergleich und gerendertes Layout.
