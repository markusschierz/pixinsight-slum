# Technik: PixInsight-Laufzeit und SPFC-Nachweis

## Laufzeit und geprüfte Schnittstellen

Geprüft auf PixInsight Core **1.9.6 Lockhart** (Linux), PJSR `#engine v8`.

| Schritt | PJSR-Schnittstelle | Nachweis |
| --- | --- | --- |
| Öffnen, Ansichtswahl und Metadaten | `ImageWindow.open`, `ViewList.getMainViews`, `View.viewById`, `window.keywords`, `window.hasAstrometricSolution`, `window.imageToCelestial` | FITS-, XISF- und Ansichtsproben |
| Originalschutz | `new ImageWindow`, `view.image.assign`, `window.forceClose` nur für selbst geöffnete oder temporäre Fenster | Quell-Hashes sowie Pixel/`isModified` geöffneter Ansichten vor/nach Lauf gleich |
| Gemeinsamer gültiger Median | PixelMath-Maske für `0 < Pixel < 1` in allen Kanälen, `Image.median` mit Range-Clipping | `tests/pjsr-median-probe.js` |
| LinearFit | `LinearFit.referenceViewId`, `executeOn` auf Arbeitskopien | Reale LRGB-/RGB-Läufe |
| NoiseEvaluation | `Image.Sn`, `noiseMRS`, `noiseKSigma`, `selectedRect.area` | Exakter Werteabgleich mit installiertem NoiseEvaluation 2.1.1 |
| SLUM und Ausgabe | `PixelMath` ohne Rescale/Truncate, `newImageSampleFormat = PixelMath.f32`, `ImageWindow.saveAs`, `File.move`, `ImageWindow.show`, `bringToFront` | 32-Bit-Float-Graustufen-XISF oder erhaltene SLUM-Ansicht und Pixelvergleich |

Die Medianberechnung läuft über das ganze gemeinsame Raster. Pixel an Registrierungsrändern (0), gesättigte Pixel (≥1), negative und nicht endliche Werte werden aus allen Kanalmedianen an derselben Position entfernt. Die temporäre Medianansicht wird nach jedem Kanal geschlossen.

Bei einer Ansichtsquelle liest das Skript die aktuelle Hauptansicht und kopiert sie unmittelbar in ein eigenes 32-Bit-Arbeitsfenster. Die vom Nutzer geöffnete Ansicht wird weder verarbeitet noch geschlossen. Datei- und Ansichtsquellen können innerhalb eines Laufs gemischt werden. `tests/pjsr-view-probe.js` und `tests/pjsr-view-ui-probe.js` prüfen diese Pfade.

Bei Ausgabe als Ansicht bleibt das PixelMath-Ergebnis mit der ID `SLUM` oder einer freien nummerierten Variante bestehen. Die Arbeitsansichten werden geschlossen; es gibt keinen Aufruf der Datei-Speicherfunktion. `tests/pjsr-output-view-probe.js` prüft Ergebnis, Dialog und Abbruch.

`analyze()` öffnet beziehungsweise kopiert die Quellen, prüft die Geometrie und bestimmt den gemeinsamen gültigen Median. `selectReference()` ändert nur die Referenz-ID. Erst `create()` oder `createView()` ruft LinearFit und NoiseEvaluation auf; beide verwenden die endgültige Referenz. Die fertigen Werte werden vor dem Cleanup für das Ergebnisprotokoll festgehalten. `tests/pjsr-deferred-fit-probe.js` und der reale LRGB-Lauf prüfen die Reihenfolge.

WCS-Lösungen werden an drei Bildpositionen verglichen. Unterschiedliche Lösungen blockieren den Lauf. Wenn die Metadaten keine eindeutige Registrierung belegen, muss der Nutzer das gemeinsame Ausgaberaster bestätigen. Das Skript registriert oder resampelt nicht.

Die Noise-Funktion verwendet denselben Algorithmus wie das mitgelieferte `NoiseEvaluation.js` v2.1.1: `Sn`-Skalierung, MRS von vier bis zwei Ebenen mit 1-%-Schwelle, danach k-Sigma-Fallback. `tests/pjsr-noise-parity.js` vergleicht die Werte direkt mit der installierten Funktion.

## SPFC-Nachweis

Geprüft mit PixInsight Core 1.9.6 und den vier lokalen, nicht versionierten Dateien `flux-samples/{L,R,G,B}_FLUX.xisf` gegenüber `sample-data/{L,R,G,B}.fit`.

Die installierte PixInsight-Quelle [`FluxCalibrationData.h`](/opt/PixInsight/include/pcl/FluxCalibrationData.h) beschreibt `FluxScaleFactors` als kanalbezogene Flux-Skalierungsfaktoren und `NormalizationFactor` als gemeinsamen Faktor für die rohen Kalibrationsfaktoren. Der aktuelle Wert beträgt `10⁸`; diese Normierung hält die Zahlen handhabbar. Das installierte [`AstrometricRegistrationEngine.js`](/opt/PixInsight/src/scripts/AstrometricRegistration/AstrometricRegistrationEngine.js) schreibt SPFC-Version, Faktoren, Streuung, FWHM, Sternanzahl und Normierung als permanente XISF-Eigenschaften. SPFC bestimmt somit eine Pixelumrechnung, während die Eigenschaften die Kalibration bezeichnen.

Die native Probe [`pjsr-spfc-data-probe.js`](../tests/pjsr-spfc-data-probe.js) las für L/R/G/B die Faktoren `7.1119224082 / 2.2058691115 / 2.5727997766 / 2.2974328169`, Version `1` und Normierung `100000000`. An drei Pixelpositionen pro Kanal waren die Original- und SPFC-XISF-Werte **bitgenau identisch**. SPFC hat in diesen Beispielen die Bildpixel nicht skaliert; ein Verzicht auf die Skalierung würde die Kanäle auf ihren instrumentellen Signalskalen belassen.

Für einen einheitlichen Satz mit Version 1 und identischem Normierungsfaktor `N` verwendet SLUM auf jeder temporären Arbeitskopie `I_flux = K × I_original`. Das entspricht der physikalischen Flux-Skala `I_original × K/N` bis auf den gemeinsamen Faktor `N`; dieser gemeinsame Faktor ändert die relative Kanalnormalisierung nicht. NoiseEvaluation folgt erst danach. Der SPFC-Faktor darf nur einmal angewendet werden. Die Eingabepixel und Eigenschaften werden nie verändert.

Der automatische SPFC-Weg ist auf vollständige positive, endliche Monochrom-Eigenschaften der Version 1 mit gleicher Normierung begrenzt. Vorhandene SPFC-Eigenschaften einer geöffneten Ansicht werden verwendet, auch wenn die Ansicht ungespeichert ist (etwa nach SPFC → Gradientenentfernung → erneutem SPFC). SLUM kann nicht prüfen, ob die Eigenschaften noch zu den aktuellen Pixeln passen; SPFC muss deshalb als letzter Schritt nach allen Pixeländerungen laufen.

Die vier SPFC-Dateien enthalten leicht unterschiedliche Lösungen desselben registrierten Bildrasters: Bei L und B differieren die Himmelskoordinaten der untersuchten Bildecken um etwa 0,2–0,3 Bogensekunden. Bis zwei Ausgabepixel Abweichung gilt die Registrierung anhand der WCS als unsicher und wird im Protokoll genannt; die spätere UI-Vereinfachung verlangt dafür keine Dialogbestätigung mehr. Größere WCS-Versätze bleiben ein harter Fehler. Diese Toleranz ersetzt keine Registrierung; sie behandelt unabhängige Plate-Solve-Ergebnisse auf bereits registrierten Pixeln.
