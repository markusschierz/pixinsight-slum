# SLUM für PixInsight und Siril

PixInsight-Skript zur Erzeugung einer linearen Super-Luminanz aus zwei bis vier vorbereiteten L-, R-, G- und B-Mastern. Jeder Kanal kann aus einer Datei oder einer bereits geöffneten Hauptansicht stammen. Als Ausgabe kann eine neue XISF-Datei gespeichert oder eine SLUM-Ansicht in PixInsight erzeugt werden. Originaldateien und Ansichten bleiben unverändert.

**Projektstatus:** MVP, SPFC und die zweistufige RGBLUM-Gewichtung sind implementiert. Die [fachliche SPEC](SPEC.md), die [SPFC-Ergänzung](SPEC-SPFC.md), die [RGBLUM-Gewichtsregel](SPEC-RGBLUM.md), der [Umsetzungsplan](tasks/plan.md), die [Aufgabenliste](tasks/todo.md) und der [fachliche Workflow](docs/pixinsight_super_lum_workflow.md) sind dokumentiert.

Das [führende Issue #1](https://github.com/markusschierz/pixinsight-slum/issues/1) bündelt den MVP; [Issue #11](https://github.com/markusschierz/pixinsight-slum/issues/11) führt SPFC und [Issue #13](https://github.com/markusschierz/pixinsight-slum/issues/13) die zweistufige Gewichtung. Interne Umsetzungsschritte werden nicht als eigene Issues angelegt.

## Siril-Version

Seit v1.1.0 gibt es zusätzlich ein Python-Skript für **Siril 1.4 oder neuer** (`SLUM-Siril-v1.2.1.zip`). Es nutzt dieselbe Gewichtsregel (`1/noise²` innerhalb RGB, L-Anteil 50–80 %), LinearFit mit wählbarer Referenz und liefert eine neue 32-Bit-FITS-Datei. Quellen sind Dateien oder das aktuell in Siril geladene Bild. Unterschiede zu PixInsight: kein SPFC-Flux, und die Rauschmessung ist eine eigene numpy-Umsetzung, die leicht von NoiseEvaluation abweicht. Installation und Bedienung stehen in [`packaging/INSTALL-Siril.txt`](packaging/INSTALL-Siril.txt), die Spezifikation in [SPEC-SIRIL.md](SPEC-SIRIL.md).

## Installation (PixInsight)

Die aktuelle [GitHub-Version](https://github.com/markusschierz/pixinsight-slum/releases/latest) enthält ein installierbares ZIP mit allen Skriptdateien und einem SVG-Icon. `SLUM-v1.2.1.zip` entpacken und in PixInsight 1.9.6 oder neuer **Script → Feature Scripts…** öffnen. Dort alte SLUM-Einträge aus früheren oder temporären Ordnern entfernen, dann mit **Add** nur den entpackten Ordner `SLUM` auswählen und die Erkennung abschließen. Danach liegt das Skript mit eigenem Icon unter **Script → astro-foto.ch → SLUM**. Die Dateien im Ordner `SLUM` zusammenlassen; `SLUM.js` lädt die weiteren JavaScript-Dateien relativ zu seinem Pfad.

Für die Entwicklung kann stattdessen der Ordner `src` über **Feature Scripts… → Add** eingebunden werden. Dabei den installierten SLUM-Eintrag vorher entfernen, damit nur eine Version registriert ist. Die Metadaten-Direktiven und dieser Installationsweg entsprechen der [PixInsight-PJSR-Dokumentation](https://pixinsight.com/doc/docs/PJSR/PJSR.html#lbl_metadata).

## Anwendung

1. **Script → astro-foto.ch → SLUM** öffnen. Ohne Installation kann [`src/SLUM.js`](src/SLUM.js) weiterhin über **Script → Execute Script** ausgeführt werden.
2. Für zwei bis vier Kanäle jeweils **Datei** oder **Ansicht** wählen. Die Ansichtsliste zeigt geöffnete PixInsight-Hauptansichten; **Aktualisieren** lädt sie nach dem Öffnen weiterer Bilder neu.
3. **Analysieren** starten. Das Skript prüft die Eingaben, zeigt den SPFC-Status je Kanal und berechnet die Mediane. Normalisierung und Noise laufen jetzt noch nicht.
4. Sind vollständige und vergleichbare SPFC-Daten vorhanden, ist **SPFC-Flux** vorausgewählt. Andernfalls SPFC außerhalb des Skripts nachholen und erneut analysieren oder **LinearFit verwenden (Fallback)** ausdrücklich wählen. Bei LinearFit wird L als Referenz vorgeschlagen, falls vorhanden, sonst der Kanal mit dem niedrigsten Median. Jeder ausgewählte Kanal kann als Referenz übersteuert werden, ohne die Analyse zu wiederholen.
5. Natives Sampling je Kanal prüfen und bei Bedarf ändern; **3×3** wird ebenso wie 1×1 und 2×2 unterstützt. Wenn **L** gewählt ist, den **L-Anteil an SLUM** zwischen 50 und 80 % einstellen (Startwert 70 %). Das Skript bildet `SLUM = a × L + (1−a) × RGBLUM`. Unter **RGB-Sampling-Gewichtung** ist die Gewichtung der gewählten Farbkanäle anhand von `1/noise²` voreingestellt. Optional **Manuell** wählen und die ersten RGB-Prozentwerte eingeben; der letzte gewählte Farbkanal erhält den Rest zu 100 %. Ohne L gelten diese RGB-Gewichte direkt für SLUM, der L-Regler entfällt. Bei gemischtem Sampling ist die automatische Noise-Gewichtung eine Heuristik, die sich manuell übersteuern lässt.
6. Unter **Ausgabe** entweder **Als Datei speichern** mit neuem `.xisf`-Ziel oder **Als SLUM-Ansicht ausgeben** wählen und **SLUM erstellen**. Die Bilder müssen bereits linear, registriert, gleich beschnitten und gradientenkorrigiert sein; dafür gibt es keine Bestätigungs-Checkboxen. Erst bei der Ausgabe laufen Skalierung oder LinearFit, danach NoiseEvaluation, Gewichtung und Kombination. Das Ergebnisprotokoll nennt Verfahren, Faktoren oder Referenz, Noise, `count(%)`, RGBLUM-interne Gewichte und Endgewichte.

Die Eingaben müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein. Bei Ansichtsquellen werden die aktuellen Pixel zum Zeitpunkt der Analyse kopiert; das Original bleibt geöffnet und unverändert. Vorhandene SPFC-Eigenschaften einer Ansicht werden auch ohne Speichern verwendet; SPFC muss dafür als letzter Schritt nach allen Pixeländerungen laufen. Das Ergebnis ist in beiden Modi ein 32-Bit-Float-Graustufenbild. Im Dateimodus wird eine neue XISF gespeichert; ein vorhandenes Ziel wird nicht überschrieben. Im Ansichtsmodus bleibt eine neue Ansicht namens `SLUM` (bei Namenskollision `SLUM_1` usw.) in PixInsight erhalten, ohne Datei zu schreiben. Die [SPFC-Evidenz](docs/spfc-evidence.md), [Laufzeitnotiz](docs/runtime.md) und das [Abnahmeprotokoll](docs/acceptance.md) halten die technischen Prüfungen fest.

Das Skript prüft gleiche Bildabmessungen und vorhandene Geometriemetadaten; ein WCS-Versatz von mehr als zwei Ausgabepixeln wird abgewiesen. Fehlende oder nicht eindeutig gleiche WCS-Daten werden im Protokoll als Unsicherheit gemeldet, blockieren die Ausgabe jedoch nicht. Die tatsächliche Registrierung ist deshalb vor dem Skriptlauf sicherzustellen.

RGBLUM ist ein interner Rechenschritt; es entsteht nur die gewählte SLUM-Ausgabe. Bei L mit nur einem Farbkanal erhält dieser den gesamten RGBLUM-Anteil. Der L-Slider ändert nach der Analyse nur die Mischung und startet weder LinearFit noch NoiseEvaluation.

**Beispiel ASI294MM Pro:** L mit Bin 2×2 und R/G/B mit Bin 3×3: 70 % L bedeutet 30 % RGBLUM. R/G/B teilen sich diese 30 % standardmäßig anhand ihrer nach der Normalisierung gemessenen Noise-Werte. Die Master müssen trotz unterschiedlichem ursprünglichem Binning auf demselben registrierten Ausgaberaster und mit denselben Bildmaßen liegen.

## Entwicklungsprüfung

- Release-ZIPs bauen: `python3 scripts/build-release.py v1.2.1` (optional `--target pixinsight` oder `--target siril`); die Ausgabe unter `dist/` bleibt ungetrackt. Das PixInsight-ZIP enthält nur die sieben nötigen Skript-/Icon-Dateien und `INSTALL.txt`, das Siril-ZIP `SLUM.py`, den Modulordner `slum_lib`, Lizenz und Installationshinweise.
- Siril-Tests: `python3 -m unittest discover -s tests/siril -p "test_*.py"` (benötigt numpy). Integrationsproben in echtem Siril: `tests/siril/siril_probe.py` und `siril_ui_probe.py` über den Siril-Befehl `pyscript` starten.
- Rechen- und Statistiktests: `node --test tests/*.test.cjs`
- GitHub Actions führt diese Node-Tests und die Python-Tests bei Pull Requests und Pushes nach `main` aus. Die Checks `node-tests` und `python-tests` können als erforderlicher Check für `main` gesetzt werden.
- PixInsight-Probe: `/usr/bin/PixInsight --automation-mode --run=<absoluter Pfad zu tests/pjsr-probe.js> --force-exit`.
- Weitere Proben: `pjsr-median-probe.js`, `pjsr-noise-parity.js`, `pjsr-engine-probe.js`, `pjsr-geometry-probe.js`, `pjsr-ui-probe.js`, `pjsr-view-probe.js`, `pjsr-view-ui-probe.js`, `pjsr-output-view-probe.js`, `pjsr-deferred-fit-probe.js`, `pjsr-mixed-probe.js`, `pjsr-rgblum-mixed-probe.js`, `pjsr-real-probe.js`, `pjsr-real-view-probe.js` sowie die `pjsr-spfc-*-probe.js` unter `tests/` mit demselben Aufruf. Die Proben lesen lokale Daten aus `sample-data/` bzw. `flux-samples/` unterhalb des Verzeichnisses in der Umgebungsvariable `SLUM_ROOT` (Standard: aktuelles Verzeichnis); diese Daten sind nicht im Repo enthalten.; Testausgaben nach `/tmp` werden entfernt.
