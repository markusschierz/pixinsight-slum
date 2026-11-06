# PixInsight SLUM

PixInsight-Skript zur Erzeugung einer linearen Super-Luminanz aus zwei bis vier vorbereiteten L-, R-, G- und B-Mastern. Jeder Kanal kann aus einer Datei oder einer bereits geöffneten Hauptansicht stammen. Als Ausgabe kann eine neue XISF-Datei gespeichert oder eine SLUM-Ansicht in PixInsight erzeugt werden. Originaldateien und Ansichten bleiben unverändert.

**Projektstatus:** Die [fachliche SPEC](SPEC.md), der [Umsetzungsplan](tasks/plan.md) und die [Aufgabenliste](tasks/todo.md) sind freigegeben. Der MVP ist implementiert und liegt in gestapelten Draft-PRs zur Prüfung. Der [fachliche Workflow](docs/pixinsight_super_lum_workflow.md) liegt als Referenz bei.

Das [führende Issue #1](https://github.com/markusschierz/pixinsight-slum/issues/1) bündelt den fachlichen Umfang. Interne Umsetzungsschritte werden dort nicht als eigene Issues angelegt.

## Anwendung

1. In PixInsight 1.9.6 oder neuer **Script → Execute Script** öffnen und [`src/SLUM.js`](src/SLUM.js) wählen.
2. Für zwei bis vier Kanäle jeweils **Datei** oder **Ansicht** wählen. Die Ansichtsliste zeigt geöffnete PixInsight-Hauptansichten; **↻** aktualisiert sie nach dem Öffnen weiterer Bilder. Unter **Ausgabe** entweder **Als Datei speichern** mit neuem `.xisf`-Ziel oder **Als SLUM-Ansicht ausgeben** wählen.
3. **Analysieren** starten. Das Skript prüft die Eingaben, ermittelt den niedrigsten gemeinsamen gültigen Median und schlägt die Referenz vor. LinearFit und Noise laufen jetzt noch nicht.
4. Referenz und natives Sampling je Kanal prüfen und bei Bedarf ändern. Ein Referenzwechsel rechnet die Analyse nicht erneut. Bei mehreren Sampling-Gruppen die Anteile in Prozent eingeben; die Summe muss 100 % betragen.
5. Vorbedingungen und gegebenenfalls das gemeinsame registrierte Raster bestätigen und **SLUM erstellen** wählen. Erst jetzt führt das Skript LinearFit, NoiseEvaluation, Gewichtung und Ausgabe aus. Noise, `count(%)` und Endgewichte erscheinen anschließend im Protokoll.

Die Eingaben müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein. Bei Ansichtsquellen werden die aktuellen Pixel zum Zeitpunkt der Analyse kopiert; das Original bleibt geöffnet und unverändert. Das Ergebnis ist in beiden Modi ein 32-Bit-Float-Graustufenbild. Im Dateimodus wird eine neue XISF gespeichert; ein vorhandenes Ziel wird nicht überschrieben. Im Ansichtsmodus bleibt eine neue Ansicht namens `SLUM` (bei Namenskollision `SLUM_1` usw.) in PixInsight erhalten, ohne Datei zu schreiben. Die [Laufzeitnotiz](docs/runtime.md) erklärt die verwendeten PJSR-Schnittstellen; das [Abnahmeprotokoll](docs/acceptance.md) hält die Prüfungen fest.

## Entwicklungsprüfung

- Rechen- und Statistiktests: `node --test tests/*.test.cjs`
- PixInsight-Probe: `/usr/bin/PixInsight --automation-mode --run=<absoluter Pfad zu tests/pjsr-probe.js> --force-exit`.
- Weitere Proben: `pjsr-median-probe.js`, `pjsr-noise-parity.js`, `pjsr-engine-probe.js`, `pjsr-geometry-probe.js`, `pjsr-ui-probe.js`, `pjsr-view-probe.js`, `pjsr-view-ui-probe.js`, `pjsr-output-view-probe.js`, `pjsr-deferred-fit-probe.js`, `pjsr-mixed-probe.js`, `pjsr-real-probe.js` und `pjsr-real-view-probe.js` unter `tests/` mit demselben Aufruf. Jede Probe schreibt nur vorübergehend Testbilder nach `/tmp` und protokolliert dort ihr Ergebnis.
