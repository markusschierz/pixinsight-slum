# PixInsight SLUM

PixInsight-Skript zur Erzeugung einer linearen Super-Luminanz aus zwei bis vier vorbereiteten L-, R-, G- und B-Mastern. Die Originaldateien bleiben unverändert; dauerhaft wird nur die fertige SLUM-XISF-Datei erzeugt.

**Projektstatus:** Die [fachliche SPEC](SPEC.md), der [Umsetzungsplan](tasks/plan.md) und die [Aufgabenliste](tasks/todo.md) sind freigegeben. Der MVP ist implementiert und liegt in gestapelten Draft-PRs zur Prüfung. Der [fachliche Workflow](docs/pixinsight_super_lum_workflow.md) liegt als Referenz bei.

Das [führende Issue #1](https://github.com/markusschierz/pixinsight-slum/issues/1) bündelt den fachlichen Umfang. Interne Umsetzungsschritte werden dort nicht als eigene Issues angelegt.

## Anwendung

1. In PixInsight 1.9.6 oder neuer **Script → Execute Script** öffnen und [`src/SLUM.js`](src/SLUM.js) wählen.
2. Zwei bis vier vorbereitete Monochrom-Master bei L, R, G und B auswählen und eine neue `.xisf`-Zieldatei festlegen.
3. **Analysieren** starten. Das Skript ermittelt den niedrigsten gemeinsamen gültigen Median, schlägt die Referenz vor, führt LinearFit auf temporären Kopien aus und misst Noise der endgültigen Bildversionen.
4. Natives Sampling je Kanal prüfen und bei Bedarf korrigieren. Bei mehreren Sampling-Gruppen die Anteile in Prozent eingeben; die Summe muss 100 % betragen. Ein Referenzwechsel löst Fit und Noise-Messung neu aus.
5. Vorbedingungen und gegebenenfalls das gemeinsame registrierte Raster bestätigen, Werte im Protokoll prüfen und **SLUM erstellen** wählen.

Die Eingaben müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein. Die Datei- und Bildansichtsoriginale werden nicht verändert. Bei Erfolg bleibt nur die neue 32-Bit-Float-Graustufen-XISF. Ein vorhandenes Ziel wird nicht überschrieben. Die [Laufzeitnotiz](docs/runtime.md) erklärt die verwendeten PJSR-Schnittstellen; das [Abnahmeprotokoll](docs/acceptance.md) hält die Prüfungen fest.

## Entwicklungsprüfung

- Rechen- und Statistiktests: `node --test tests/*.test.cjs`
- PixInsight-Probe: `/usr/bin/PixInsight --automation-mode --run=<absoluter Pfad zu tests/pjsr-probe.js> --force-exit`.
- Weitere Proben: `pjsr-median-probe.js`, `pjsr-noise-parity.js`, `pjsr-engine-probe.js`, `pjsr-geometry-probe.js`, `pjsr-ui-probe.js`, `pjsr-mixed-probe.js` und `pjsr-real-probe.js` unter `tests/` mit demselben Aufruf. Jede Probe schreibt nur vorübergehend Testbilder nach `/tmp` und protokolliert dort ihr Ergebnis.
