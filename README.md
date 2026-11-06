# PixInsight SLUM

PixInsight-Skript zur Erzeugung einer linearen Super-Luminanz aus zwei bis vier vorbereiteten L-, R-, G- und B-Mastern. Jeder Kanal kann aus einer Datei oder einer bereits geöffneten Hauptansicht stammen. Als Ausgabe kann eine neue XISF-Datei gespeichert oder eine SLUM-Ansicht in PixInsight erzeugt werden. Originaldateien und Ansichten bleiben unverändert.

**Projektstatus:** MVP, SPFC und die zweistufige RGBLUM-Gewichtung sind implementiert. Die [fachliche SPEC](SPEC.md), die [SPFC-Ergänzung](SPEC-SPFC.md), die [RGBLUM-Gewichtsregel](SPEC-RGBLUM.md), der [Umsetzungsplan](tasks/plan.md), die [Aufgabenliste](tasks/todo.md) und der [fachliche Workflow](docs/pixinsight_super_lum_workflow.md) sind dokumentiert.

Das [führende Issue #1](https://github.com/markusschierz/pixinsight-slum/issues/1) bündelt den MVP; [Issue #11](https://github.com/markusschierz/pixinsight-slum/issues/11) führt SPFC und [Issue #13](https://github.com/markusschierz/pixinsight-slum/issues/13) die zweistufige Gewichtung. Interne Umsetzungsschritte werden nicht als eigene Issues angelegt.

## Anwendung

1. In PixInsight 1.9.6 oder neuer **Script → Execute Script** öffnen und [`src/SLUM.js`](src/SLUM.js) wählen.
2. Für zwei bis vier Kanäle jeweils **Datei** oder **Ansicht** wählen. Die Ansichtsliste zeigt geöffnete PixInsight-Hauptansichten; **↻** aktualisiert sie nach dem Öffnen weiterer Bilder. Unter **Ausgabe** entweder **Als Datei speichern** mit neuem `.xisf`-Ziel oder **Als SLUM-Ansicht ausgeben** wählen.
3. **Analysieren** starten. Das Skript prüft die Eingaben, zeigt den SPFC-Status je Kanal und berechnet die Mediane. Normalisierung und Noise laufen jetzt noch nicht.
4. Sind vollständige und vergleichbare SPFC-Daten vorhanden, ist **SPFC-Flux** vorausgewählt. Andernfalls SPFC außerhalb des Skripts nachholen und erneut analysieren oder **LinearFit verwenden (Fallback)** ausdrücklich wählen. Bei LinearFit wird L als Referenz vorgeschlagen, falls vorhanden, sonst der Kanal mit dem niedrigsten Median. Jeder ausgewählte Kanal kann als Referenz übersteuert werden, ohne die Analyse zu wiederholen.
5. Natives Sampling je Kanal prüfen und bei Bedarf ändern; **3×3** wird ebenso wie 1×1 und 2×2 unterstützt. Wenn **L** gewählt ist, den **L-Anteil an SLUM** zwischen 50 und 80 % einstellen (Startwert 70 %). Das Skript gewichtet R/G/B innerhalb einer logischen RGB-Luminanz nach Noise und bildet `SLUM = a × L + (1−a) × RGBLUM`. Haben die gewählten Farbkanäle **untereinander** verschiedene Sampling-Werte, verteilt ein Slider RGBLUM zwischen zwei Gruppen; bei drei Gruppen steuern zwei Slider die ersten beiden Anteile, die dritte erhält automatisch den Rest. Die Slider müssen einmal bewusst bewegt werden. Ohne L gilt die bisherige RGB-Gewichtung und die L-Steuerung entfällt. Vorbedingungen und gegebenenfalls das gemeinsame registrierte Raster bestätigen und **SLUM erstellen** wählen. Erst jetzt laufen Skalierung oder LinearFit, danach NoiseEvaluation, Gewichtung und Ausgabe. Das Ergebnisprotokoll nennt Verfahren, Faktoren oder Referenz, Noise, `count(%)`, RGBLUM-interne Gewichte und Endgewichte.

Die Eingaben müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein. Bei Ansichtsquellen werden die aktuellen Pixel zum Zeitpunkt der Analyse kopiert; das Original bleibt geöffnet und unverändert. Eine seit dem Speichern veränderte Ansicht wird für SPFC abgewiesen, weil ihre Metadaten möglicherweise nicht mehr zu den Pixeln passen. Das Ergebnis ist in beiden Modi ein 32-Bit-Float-Graustufenbild. Im Dateimodus wird eine neue XISF gespeichert; ein vorhandenes Ziel wird nicht überschrieben. Im Ansichtsmodus bleibt eine neue Ansicht namens `SLUM` (bei Namenskollision `SLUM_1` usw.) in PixInsight erhalten, ohne Datei zu schreiben. Die [SPFC-Evidenz](docs/spfc-evidence.md), [Laufzeitnotiz](docs/runtime.md) und das [Abnahmeprotokoll](docs/acceptance.md) halten die technischen Prüfungen fest.

RGBLUM ist ein interner Rechenschritt; es entsteht nur die gewählte SLUM-Ausgabe. Bei L mit nur einem Farbkanal erhält dieser den gesamten RGBLUM-Anteil. Der L-Slider ändert nach der Analyse nur die Mischung und startet weder LinearFit noch NoiseEvaluation.

**Beispiel ASI294MM Pro:** L mit Bin 2×2 und R/G/B mit Bin 3×3 ergibt **eine** RGB-Gruppe. Der Gruppen-Slider entfällt; 70 % L bedeutet 30 % RGBLUM, die sich R/G/B nach Noise teilen. Die Master müssen trotz unterschiedlichem ursprünglichem Binning auf demselben registrierten Ausgaberaster und mit denselben Bildmaßen liegen.

## Entwicklungsprüfung

- Rechen- und Statistiktests: `node --test tests/*.test.cjs`
- GitHub Actions führt diese Node-Tests bei Pull Requests und Pushes nach `main` aus. Der Check `node-tests` kann als erforderlicher Check für `main` gesetzt werden.
- PixInsight-Probe: `/usr/bin/PixInsight --automation-mode --run=<absoluter Pfad zu tests/pjsr-probe.js> --force-exit`.
- Weitere Proben: `pjsr-median-probe.js`, `pjsr-noise-parity.js`, `pjsr-engine-probe.js`, `pjsr-geometry-probe.js`, `pjsr-ui-probe.js`, `pjsr-view-probe.js`, `pjsr-view-ui-probe.js`, `pjsr-output-view-probe.js`, `pjsr-deferred-fit-probe.js`, `pjsr-mixed-probe.js`, `pjsr-rgblum-mixed-probe.js`, `pjsr-real-probe.js`, `pjsr-real-view-probe.js` sowie die `pjsr-spfc-*-probe.js` unter `tests/` mit demselben Aufruf. Die SPFC-Proben nutzen die lokalen `flux-samples/`; Testausgaben nach `/tmp` werden entfernt.
