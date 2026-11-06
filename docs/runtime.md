# PixInsight-Laufzeit und geprüfte Schnittstellen

Geprüft auf PixInsight Core **1.9.6 Lockhart** (Linux), PJSR `#engine v8`.

| Schritt | PJSR-Schnittstelle | Nachweis |
| --- | --- | --- |
| Öffnen und Metadaten | `ImageWindow.open`, `window.keywords`, `window.hasAstrometricSolution`, `window.imageToCelestial` | FITS- und XISF-Proben |
| Originalschutz | `new ImageWindow`, `view.image.assign`, `window.forceClose` | Quell-Hashes vor/nach realem Lauf gleich |
| Gemeinsamer gültiger Median | PixelMath-Maske für `0 < Pixel < 1` in allen Kanälen, `Image.median` mit Range-Clipping | `tests/pjsr-median-probe.js` |
| LinearFit | `LinearFit.referenceViewId`, `executeOn` auf Arbeitskopien | Reale LRGB-/RGB-Läufe |
| NoiseEvaluation | `Image.Sn`, `noiseMRS`, `noiseKSigma`, `selectedRect.area` | Exakter Werteabgleich mit installiertem NoiseEvaluation 2.1.1 |
| SLUM und Ausgabe | `PixelMath` ohne Rescale/Truncate, `newImageSampleFormat = PixelMath.f32`, `ImageWindow.saveAs`, `File.move` | 32-Bit-Float-Graustufen-XISF und Pixelvergleich |

Die Medianberechnung läuft über das ganze gemeinsame Raster. Pixel an Registrierungsrändern (0), gesättigte Pixel (≥1), negative und nicht endliche Werte werden aus allen Kanalmedianen an derselben Position entfernt. Die temporäre Medianansicht wird nach jedem Kanal geschlossen.

WCS-Lösungen werden an drei Bildpositionen verglichen. Unterschiedliche Lösungen blockieren den Lauf. Wenn die Metadaten keine eindeutige Registrierung belegen, muss der Nutzer das gemeinsame Ausgaberaster bestätigen. Das Skript registriert oder resampelt nicht.

Die Noise-Funktion verwendet denselben Algorithmus wie das mitgelieferte `NoiseEvaluation.js` v2.1.1: `Sn`-Skalierung, MRS von vier bis zwei Ebenen mit 1-%-Schwelle, danach k-Sigma-Fallback. `tests/pjsr-noise-parity.js` vergleicht die Werte direkt mit der installierten Funktion.
