# PixInsight-Laufzeit und geprüfte Schnittstellen

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
