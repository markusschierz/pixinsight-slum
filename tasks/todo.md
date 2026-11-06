# Aufgabenliste: PixInsight SLUM

**Status:** Freigegeben am 6. November 2026; Aufgaben 1–9 sowie die ergänzte Quellen- und Ausgabewahl und der verschobene Fit-Zeitpunkt implementiert und geprüft. Die Tab-Navigation wurde vom Nutzer bestätigt. [Abnahmeprotokoll](../docs/acceptance.md).

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
- **Abnahme:** Die später korrigierte Reihenfolge lässt Referenzwechsel ohne erneute Analyse zu; Fit und Noise laufen erst bei der Ausgabe auf der endgültig gewählten Referenz.
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
- [x] Tab-Reihenfolge in einer interaktiven PixInsight-Sitzung manuell prüfen (vom Nutzer am 6. November 2026 als in Ordnung bestätigt).
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

## PR 7 – Datei oder SLUM-Ansicht als Ausgabe

Die spätere Nutzerergänzung erweitert die Ausgabe innerhalb des führenden Issues #1.

- [x] Im Dialog zwischen **Als Datei speichern** und **Als SLUM-Ansicht ausgeben** wählen; nur im Dateimodus ist ein XISF-Ziel erforderlich.
- [x] Dieselbe gewichtete PixelMath-Berechnung für beide Modi nutzen; die neue SLUM-Ansicht bleibt nach dem Aufräumen erhalten.
- [x] Namenskollisionen mit `SLUM_1` usw. behandeln, beim Abbruch die neue Ansicht entfernen und Originale unverändert lassen.
- **Prüfung:** Native PixInsight-Probe für Bildformat, Pixelwert, keine Datei im Ansichtsmodus, erhaltene Ansicht, Namenskollision, Abbruch und Dialogzustand; Regression des Dateimodus.

## PR 8 – LinearFit und Noise bei der Ausgabe

- [x] Analyse auf Eingabeprüfung, Arbeitskopien und gemeinsamen gültigen Median beschränken.
- [x] Referenzwechsel ohne erneutes Laden, Medianberechnen oder Fitten ermöglichen.
- [x] LinearFit, NoiseEvaluation, Gewichte und Warnungen beim Erzeugen der Datei oder Ansicht berechnen und im Ergebnisprotokoll anzeigen.
- [x] Dateimodus, Ansichtsmodus, Abbruch und Originalschutz prüfen.
- **Messung:** Reale LRGB-Stacks: Analyse 3,855 s, Referenzwechsel unter 1 ms, XISF-Ausgabe 44,248 s; Gewichte und Ausgabepixel wie zuvor.

## SPFC-Erweiterung – führendes Issue #11

- [x] **SPFC 1:** Installierte PixInsight-Quelle und `flux-samples/*_FLUX.xisf` auf vollständige Eigenschaften, Bedeutung der Skalierung und bereits veränderte Pixel prüfen; reproduzierbaren Nachweis dokumentieren. **Abnahme:** Eine eindeutige, mathematisch und anhand von Pixeln geprüfte Regel oder eine explizite Sperre für den SPFC-Weg. **Betroffen:** `docs/`, PixInsight-Probe. **Abhängigkeit:** keine.
- [x] **SPFC 2:** Vollständig gültigen SPFC-Satz für Datei- und Ansichtsquellen erkennen und mit einheitlicher Flux-Regel zu einer SLUM verarbeiten; Noise erst auf fertigen Arbeitsbildern messen. **Abnahme:** SPFC-LRGB und SPFC-RGB ohne LinearFit, korrekte Pixel/Noise/Gewichte, Originale unverändert. **Betroffen:** Engine, Dialog, Tests. **Abhängigkeit:** SPFC 1.
- [x] **SPFC 3:** Fehlende/ungültige Eigenschaften pro Kanal erklären und Ausgabe bis zum ausdrücklich gewählten LinearFit-Fallback sperren; L-Default oder Median-Default mit Override ermöglichen. **Abnahme:** Referenzwechsel ohne Neuanalyse; gewählte Referenz wird tatsächlich verwendet. **Betroffen:** Engine, Dialog, Tests. **Abhängigkeit:** SPFC 2.
- [x] **SPFC 4:** Datei- und Ansichtsmodus, gemischtes Sampling, Fortschritt, Ergebnisprotokoll und Cleanup prüfen und dokumentieren. **Abnahme:** Fehler und Abbruch ohne Teilergebnis, Regression der bisherigen Wege. **Betroffen:** Engine, Dialog, Dokumentation, Tests. **Abhängigkeit:** SPFC 3.
