# Umsetzungsplan: PixInsight SLUM

**Status:** Freigegeben am 6. November 2026

**Fachliche Basis:** [freigegebene SPEC](../SPEC.md), [Super-Luminanz-Workflow](../docs/pixinsight_super_lum_workflow.md)

**Repository:** [markusschierz/pixinsight-slum](https://github.com/markusschierz/pixinsight-slum)

**Führendes Issue:** [markusschierz/pixinsight-slum#1](https://github.com/markusschierz/pixinsight-slum/issues/1). Alle Slices gehören zu diesem einen Issue; es werden keine Issues für interne Schritte angelegt.

## Bestehende Architektur und bestätigte Regeln

Der Plan bleibt beim festgelegten **PixInsight-Skript mit nativer PJSR-Oberfläche**. Es gibt keine Web-Anwendung und keine externe Laufzeit. Die lokal installierten PixInsight-Skripte für [NoiseEvaluation](/opt/PixInsight/src/scripts/NoiseEvaluation/NoiseEvaluation.js) und [BatchLinearFit](/opt/PixInsight/src/scripts/BatchLinearFit/BatchLinearFit.js) dienen als API-Referenz; konkrete Aufrufe werden gegen die installierte Version geprüft. Die Rechenlogik bleibt vom Dialog getrennt.

Die bestätigten fachlichen Regeln werden übernommen: automatische Referenz mit niedrigstem gültigem Median samt Override; Noise-Messung nach LinearFit auf den tatsächlich kombinierten Bildern; `1/noise²` innerhalb gleicher Sampling-Gruppen; vom Nutzer bestätigte Anteile zwischen Gruppen; Eingaben nur lesen; als Ergebnis entweder eine SLUM-XISF-Datei oder eine SLUM-Ansicht erzeugen.

**Ergänzung nach Planfreigabe:** Je Kanal kann nun auch eine bereits geöffnete PixInsight-Hauptansicht statt einer Datei gewählt werden. Die gemischte Quellenwahl verwendet denselben Fit-, Noise- und Ausgabeweg. Der zusätzliche Slice mit eigenem PR ist in der [Aufgabenliste](todo.md) festgehalten.

**Weitere Ergänzung:** Die Ausgabe kann als XISF-Datei oder als neue PixInsight-Hauptansicht erfolgen. Beide Modi verwenden dieselbe PixelMath-Berechnung; nur der Ergebnislebenszyklus unterscheidet sich. Die Ansicht bleibt nach Cleanup erhalten, und im Ansichtsmodus wird keine Datei geschrieben. Test und PR-Grenze stehen in der [Aufgabenliste](todo.md).

**Ablaufkorrektur:** Die Analyse lädt die Eingaben und bestimmt nur den gemeinsamen gültigen Median. Die Referenzwahl ändert anschließend nur die Auswahl. LinearFit und NoiseEvaluation laufen einmal bei der Ausgabe; Noise, `count(%)` und Endgewichte werden danach protokolliert. Ein eigener Slice im führenden Issue #1 deckt den Wechsel samt Zeitmessung ab.

## Vorliegende Beispieldaten

`sample-data/L.fit`, `R.fit`, `G.fit` und `B.fit` sind reale lineare Integrationsstacks mit je 9355 × 6252 Pixeln, 32-Bit-Float und laut FITS-Header jeweils 1×1-Binning. Sie decken den LRGB- und RGB-Pfad bei gleichem Sampling ab. Eine grobe bildbasierte Korrelationsprüfung fand für R, G und B relativ zu L keinen Versatz im 16-Pixel-Prüfraster; die Header enthalten jedoch keine WCS-Angaben, daher bleibt die Registrierung im PixInsight-Durchstich zu prüfen. Aus den Headern geht keine Gradientenkorrektur hervor. Die `ImageIntegration.noise`-Historienwerte ersetzen **nicht** die geforderte NoiseEvaluation nach LinearFit.

Die vier Dateien umfassen zusammen rund 893 MB, bleiben lokal und werden nicht versioniert. Für die gemischte Binning-Abnahme ist ein weiterer Datensatz oder ein gezielt erzeugter Testfall nötig.

## Abhängigkeiten und kleine Slices

| Slice / PR-Grenze | Ergebnis und betroffene Komponenten | Prüfung | Hängt ab von |
| --- | --- | --- | --- |
| **PR 1 – Laufzeit und Rechenkern** | PJSR-Kompatibilität klären; gültige Pixel/Median, Noise-Ermittlung und reine Gewichtsrechnung als getrennte Funktionen. Betroffen: Skriptkern, Testdaten, fokussierte Tests. | Vergleich von `noise` und `count(%)` mit PixInsights NoiseEvaluation; bekannte Gewichtsbeispiele und ungültige Werte. | — |
| **PR 2 – erster vollständiger Lauf** | Zwei gleich gesampelte Dateien auswählen, schreibgeschützt laden, temporär fitten und eine SLUM-XISF speichern. Betroffen: nativer Dialog, Bildlebenszyklus, LinearFit/PixelMath, Ausgabe. | Datei in PixInsight öffnen; Pixelstichproben und Gewichte prüfen; Eingabe-Hashes/Ansichten unverändert; nur SLUM bleibt. | PR 1 |
| **PR 3 – Kanäle und Referenzwahl** | Zwei bis vier Kanäle einschließlich RGB ohne L, Medianempfehlung und Override. Der ursprünglich vorgesehene Neulauf bei Referenzwechsel wurde später durch die Ablaufkorrektur ersetzt. Betroffen: Dialogzustand, Validierung, Fit-Orchestrierung. | LRGB/RGB/Teilmenge durchlaufen; Override ändert die tatsächliche Fit-Referenz; veraltete Noise-Werte werden nicht verwendet. | PR 2 |
| **PR 4 – gemischtes Binning** | Natives Sampling je Kanal erfassen oder korrigieren, Gruppen bilden und bestätigte Gruppenanteile anwenden. Betroffen: Eingabeprüfung, Dialog, Gewichtung. | L 1×1 + RGB 2×2 auf gemeinsamem Raster; Gruppen- und Kanalgewichte summieren sich zu 1; fehlende Angaben blockieren Ausgabe. | PR 3 |
| **PR 5 – Abschluss und Fehlerpfade** | Warnungen für `count(%)`, Geometrie- und Eingabefehler, Abbruch, Cleanup und Schutz vor Überschreiben vollständig absichern. Betroffen: Dialogzustände, Fehlerbehandlung, Dateilebenszyklus. | Alle SPEC-Fehlerfälle ohne Ausgabe; Abbruch/Fehler ohne Restdateien; vollständiger Regressionstest mit drei Datensätzen. | PR 4 |

Jeder PR bleibt auf das führende Issue bezogen und enthält nur den jeweils genannten Slice samt zugehörigen Tests. PR 2 etabliert den Originalschutz bereits für den ersten Dateilauf; PR 5 deckt zusätzliche Fehlerwege ab. Nach PR 2 und PR 4 liegt jeweils ein manuell prüfbarer PixInsight-Durchstich vor. Diese PR-Grenzen sind Planungsgrenzen, keine jetzt zu erstellenden PRs.

## Dialog-Vertrag

Die Oberfläche folgt Auswahl → Analyse von Eingaben und Median → Prüfung von Referenz und Sampling → „SLUM erstellen“ → Ergebnisprotokoll. Vier beschriftete Kanalzeilen zeigen Quelle und Sampling. Referenzempfehlung und Override sind klar getrennt. Gruppenanteile erscheinen nur bei gemischtem Sampling. Feldfehler sperren die Hauptaktion; `count(%)`-Warnungen erscheinen nach der Ausgabe im Ergebnisprotokoll. Tastaturreihenfolge, Fortschritt, Abbruch und Erfolgszustand werden im PixInsight-Dialog geprüft. Eine Änderung der Referenz oder Gruppenanteile vor der Ausgabe verursacht keinen erneuten Fit oder Noise-Lauf.

## Risiken und Prüfschwerpunkte

| Risiko | Umgang damit |
| --- | --- |
| PJSR-Version oder Noise-Skalierung weicht von Beispielen ab | API und Ergebnisparität in PR 1 an der lokalen Installation nachweisen. |
| Metadaten verlieren das ursprüngliche Binning nach Resampling | Sampling je Kanal anzeigen und korrigierbar machen; unbestätigte Werte sperren den Lauf. |
| Gleiche Maße täuschen korrekte Registrierung vor | Verfügbare Geometriemetadaten prüfen; bei Unklarheit ausdrückliche Nutzerbestätigung. |
| Zwischenansichten oder Teildateien bleiben nach Abbruch zurück | Temporäre Kopien konsequent schließen; Abbruch, Fehler und Speicherkonflikt gezielt prüfen. |
| PixelMath verändert den Wertebereich | Rescaling deaktivieren und Ergebniswerte gegen unabhängig berechnete Pixel prüfen. |

## Freigabegrenze

Dieser Plan ist freigegeben. Die [Aufgabenliste](todo.md) ist der nächste Freigabeschritt. Implementierung und PRs beginnen erst nach ihrer Freigabe.
