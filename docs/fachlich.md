# PixInsight Super-Luminanz – Workflow und Berechnungen

Hier ist die konsolidierte Zusammenfassung des gesamten Chats mit den für eine spätere Implementierung relevanten Regeln, Formeln und Sonderfällen.

## Ziel

Aus linearen PixInsight-Mastern `L`, `R`, `G`, `B` soll eine **Super-Luminanz / SLUM** erzeugt werden.

Grundidee: Die vier Kanäle werden nicht einfach gemittelt, sondern anhand ihres gemessenen Rauschens gewichtet. Kanäle mit geringerem Noise erhalten ein höheres Gewicht.

## 1. Standardfall: LRGB mit gleicher Pixel-Skalierung / gleichem Binning

Voraussetzungen:

- alle Bilder linear
- identischer Crop
- gleiche Bildgröße / Registrierung
- Gradientenkorrektur bereits durchgeführt
- `R`, `G`, `B` per `LinearFit` auf `L` angepasst
- danach NoiseEvaluation auf genau diesen Bildern ausführen

Der relevante Wert aus PixInsight NoiseEvaluation ist:

```text
noise
```

Beispiel:

```text
L = 1.070
R = 1.071
G = 1.119
B = 1.107
```

Für jeden Kanal wird das inverse Varianzgewicht berechnet:

```text
w = 1 / noise²
```

Also allgemein:

```text
wL = 1 / noiseL²
wR = 1 / noiseR²
wG = 1 / noiseG²
wB = 1 / noiseB²
```

Danach:

```text
weightSum = wL + wR + wG + wB
```

Super-L:

```text
SLUM =
(
    wL * L +
    wR * R +
    wG * G +
    wB * B
) / weightSum
```

Alternativ können die Gewichte vorher normalisiert werden:

```text
nL = wL / weightSum
nR = wR / weightSum
nG = wG / weightSum
nB = wB / weightSum
```

Dann:

```text
SLUM = nL*L + nR*R + nG*G + nB*B
```

Beide Varianten sind mathematisch gleich.

---

## 2. Konkretes Beispiel NGC 6822

NoiseEvaluation:

```text
NGC6822_L_MGC          = 1.070
NGC6822_R_MGC_LinFitL  = 1.071
NGC6822_G_MGC_LinFitL  = 1.119
NGC6822_B_MGC_LinFitL  = 1.107
```

Inverse-Varianz-Gewichte:

```text
L = 0.87344
R = 0.87181
G = 0.79862
B = 0.81603
```

Summe:

```text
3.35989
```

PixelMath:

```text
(
  0.87344*NGC6822_L_MGC +
  0.87181*NGC6822_R_MGC_LinFitL +
  0.79862*NGC6822_G_MGC_LinFitL +
  0.81603*NGC6822_B_MGC_LinFitL
) / 3.35989
```

Normalisierte Form:

```text
0.25996*NGC6822_L_MGC +
0.25948*NGC6822_R_MGC_LinFitL +
0.23769*NGC6822_G_MGC_LinFitL +
0.24287*NGC6822_B_MGC_LinFitL
```

Gemessenes Ergebnis:

```text
L:
noise = 1.070

SLUM:
noise = 1.012
```

Rauschreduktion gegenüber L:

```text
(1.070 - 1.012) / 1.070
≈ 0.0542
≈ 5.4 %
```

Das entspricht grob einem relativen SNR-Gewinn von:

```text
1.070 / 1.012
≈ 1.057
```

also ungefähr **5.7 %**.

---

## 3. PixInsight-PixelMath-Einstellungen

Für diese gewichtete Kombination:

```text
Use single RGB/K expression = ON
Generate output             = ON
Color space                 = Grayscale
Sample format               = 32-bit float oder 64-bit float
Rescale result              = OFF
```

Wichtig: **Rescale result muss aus sein.**

Die Formel ist bereits korrekt normalisiert. Ein zusätzliches Rescaling verändert den Wertebereich nachträglich und erschwert einen direkten Vergleich der NoiseEvaluation-Werte.

Das war eine Korrektur gegenüber einer frühen Empfehlung im Chat.

---

## 4. Empfohlener Workflow

Für den Super-L-Zweig:

```text
Roh-Master L/R/G/B
→ identischer Crop
→ Gradientenkorrektur pro Kanal
→ LinearFit: R/G/B auf L
→ NoiseEvaluation
→ inverse Varianzgewichte berechnen
→ SLUM mit PixelMath
→ Deconvolution auf SLUM
→ lineares Denoising
→ Stretch
→ weitere Luminanzbearbeitung
```

Deconvolution soll normalerweise **erst auf dem fertigen SLUM** durchgeführt werden, nicht vor `LinearFit` oder vor der Kombination.

Vorteile:

- nur eine PSF
- bessere SNR-Basis
- kein unterschiedliches Deconvolution-Verhalten zwischen L/R/G/B
- NoiseEvaluation basiert noch auf weitgehend unbehandelten linearen Daten

---

## 5. RGB-Zweig separat behandeln

Der normale RGB-Workflow kann unabhängig bleiben:

```text
R + G + B
→ ChannelCombination
→ DBE / ABE / MGC
→ SPCC
→ weitere RGB-Bearbeitung
```

Für den **SLUM-Zweig** sollten die einzelnen Kanäle dagegen möglichst vor der Kombination gradientenkorrigiert sein.

Der Grund: Ein Gradient, der noch in `R`, `G` oder `B` steckt, wird sonst Teil der synthetischen Luminanz.

---

## 6. SPFC / MGC

Für den Super-L-Zweig ist die saubere Variante:

```text
ImageSolver
→ SPFC
→ MGC
→ LinearFit
→ NoiseEvaluation
→ SLUM
```

Die Noise-Werte sollten erst nach den relevanten linearen Korrekturen bestimmt werden.

Grundregel für eine spätere Software:

```text
Gewichte immer aus genau den Bildern berechnen,
die anschließend tatsächlich kombiniert werden.
```

Nicht aus älteren, unbearbeiteten Versionen.

---

## 7. NoiseEvaluation versus SNR

Im Chat wurden zeitweise auch PixInsight-SNR-Werte verwendet, beispielsweise:

```text
L = 42.25 dB
R = 37.64 dB
G = 37.25 dB
B = 37.32 dB
```

Aus SNR kann prinzipiell eine Gewichtung angenähert werden:

```text
w ∝ 10^(SNR_dB / 10)
```

Das ist für diesen Zweck aber **nicht die bevorzugte Methode**.

Für SLUM verwenden:

```text
w = 1 / noise²
```

mit den Werten aus `NoiseEvaluation`.

Grund: Der SNR-Wert hängt zusätzlich von Signalniveau, Skalierung, Background, LinearFit usw. ab. NoiseEvaluation ist für eine inverse Varianzgewichtung besser geeignet.

Für die Software sollte daher gelten:

```text
NoiseEvaluation vorhanden:
    Noise verwenden

nur SNR vorhanden:
    optional SNR-basierte Approximation
```

---

## 8. Bedeutung von `count(%)`

NoiseEvaluation liefert zusätzlich:

```text
count(%)
```

Beispiele aus dem Chat:

```text
~90 %    sehr gut
~70 %    brauchbar
~58 %    noch brauchbar
~11 %    auffällig / wenig robust
```

`count(%)` ist **nicht Teil der Gewichtungsformel**.

Es eignet sich aber als Qualitätsindikator für die Noise-Schätzung.

Für eine Software wäre beispielsweise sinnvoll:

```text
count >= 50 %
    Noise-Wert normal verwenden

count 25–50 %
    Warnung ausgeben

count < 25 %
    Gewicht als unsicher markieren
```

Das sind sinnvolle technische Schwellen für eine Anwendung, keine feste PixInsight-Regel.

---

## 9. Sonderfall: unterschiedliches Binning

Ein wichtiger Sonderfall aus dem Chat:

```text
L   = Bin 1x1
RGB = Bin 2x2
```

zusätzlich beispielsweise:

```text
L   = 90 s Subs
RGB = 60 s Subs

Gesamtintegration L ungefähr 2–3× RGB
```

Hier dürfen die Noise-Werte **nicht blind direkt miteinander verglichen werden**.

Beispiel:

```text
L ≈ 0.928
R ≈ 0.523
G ≈ 0.508
B ≈ 0.516
```

Bei direkter Anwendung von:

```text
1 / noise²
```

würden die gebinnten RGB-Kanäle massiv höher gewichtet.

Das wäre irreführend, weil ein 2x2-Pixel bereits Signal mehrerer 1x1-Pixel enthält und daher naturgemäß einen niedrigeren Noise-Wert pro Pixel besitzt.

Für eine Software muss daher zunächst geprüft werden:

```text
pixelScaleL == pixelScaleR == pixelScaleG == pixelScaleB
```

oder zumindest:

```text
binningL == binningR == binningG == binningB
```

Wenn nicht, darf keine normale inverse-Noise-Gewichtung über alle vier Kanäle erfolgen.

---

## 10. Strategie bei gemischtem Binning

Für `L 1x1 + RGB 2x2` wurde ein hierarchischer Ansatz verwendet.

Zuerst nur RGB untereinander anhand ihrer Noise-Werte gewichten:

```text
RGBLUM =
(
    wR*R +
    wG*G +
    wB*B
) /
(wR+wG+wB)
```

Dann L bewusst dominant dazumischen, beispielsweise:

```text
SLUM = 0.70*L + 0.30*RGBLUM
```

Bei einem konkreten Datensatz ergab sich daraus:

```text
0.70*L_GRX +
0.09714*R_GRX_LFIT +
0.10305*G_GRX_LFIT +
0.09981*B_GRX_LFIT
```

Eine aggressivere Variante war:

```text
0.60*L_GRX +
0.12952*R_GRX_LFIT +
0.13740*G_GRX_LFIT +
0.13308*B_GRX_LFIT
```

Für die damaligen Daten wurde **70 % L / 30 % RGB-Luminanz** bevorzugt, da L:

- 1x1 statt 2x2 hatte
- längere Subs hatte
- deutlich mehr Gesamtintegrationszeit hatte
- die höhere räumliche Auflösung liefern sollte

Wichtig für eine spätere Implementierung: **70/30 ist keine universelle mathematische Konstante.** Es war eine pragmatische Regel für diesen Datensatz.

---

## 11. Bessere algorithmische Behandlung von gemischtem Binning

Für eine Software wäre sauberer:

```text
if all channels have same pixel scale:
    use inverse variance weighting

else:
    do not directly compare noise values
```

Dann zwei mögliche Modi:

```text
MODE A:
Resample alle Kanäle auf dieselbe effektive Skala
→ NoiseEvaluation neu bestimmen
→ inverse Varianzgewichtung

MODE B:
RGB intern gewichten
→ RGBLUM erzeugen
→ L/RGBLUM-Verhältnis separat festlegen
```

Mode B ist für den Erhalt der L-Auflösung oft sinnvoller.

---

## 12. Programmierbarer Kernalgorithmus

Für gleiche Sampling-Bedingungen lässt sich der eigentliche Algorithmus auf Folgendes reduzieren:

```text
inputs:
    image[i]
    noise[i]
    count[i]

for each channel i:
    weight[i] = 1 / noise[i]^2

weightSum = sum(weight)

for each channel i:
    normalizedWeight[i] = weight[i] / weightSum

SLUM = sum(
    normalizedWeight[i] * image[i]
)
```

Beispiel-Pseudocode:

```text
noise = {
    L: 1.070,
    R: 1.071,
    G: 1.119,
    B: 1.107
}

for channel in [L,R,G,B]:
    weight[channel] = 1 / noise[channel]^2

sumWeight = sum(weight.values())

for channel in [L,R,G,B]:
    normalized[channel] = weight[channel] / sumWeight
```

Ausgabe:

```text
L = 0.25996
R = 0.25948
G = 0.23769
B = 0.24287
```

PixelMath-Generator:

```text
0.25996*L +
0.25948*R +
0.23769*G +
0.24287*B
```

---

## 13. Welche Daten eine spätere Anwendung aufnehmen sollte

Für jeden Kanal wären mindestens diese Felder sinnvoll:

| Feld | Zweck |
|---|---|
| Image ID | PixelMath-Bezeichner |
| Channel | L/R/G/B |
| Noise | Gewichtungsgrundlage |
| Count % | Vertrauensindikator |
| Binning X/Y | Erkennung inkompatibler Noise-Werte |
| Pixel Scale | bessere Prüfung als Binning allein |
| Exposure/Sub | Information / Plausibilitätskontrolle |
| Number of Subs | Gesamtintegration |
| Total Exposure | Zusatzinformation |
| LinearFit Reference | sicherstellen, dass Skalierung vergleichbar ist |
| Gradient corrected | Workflow-Prüfung |

Die eigentliche Gewichtung im Normalfall bleibt trotzdem:

```text
1 / noise²
```

Belichtungszeit oder Anzahl Subs sollten **nicht nochmals automatisch in dasselbe Gewicht multipliziert werden**, weil deren Effekt bereits im resultierenden Noise des integrierten Masters enthalten ist.

---

## 14. Wichtigste Regeln für die geplante Software

1. **NoiseEval statt SNR bevorzugen.**
2. Gewichtung: `1 / noise²`.
3. Danach Gewichte auf Summe 1 normalisieren.
4. `Rescale result` in PixelMath ausschalten.
5. Noise erst auf den tatsächlich zu kombinierenden, vorbereiteten Bildern messen.
6. R/G/B vor SLUM auf L linearisieren/fitten.
7. Unterschiedliches Binning bzw. unterschiedliche Pixel-Skala erkennen.
8. Bei unterschiedlicher Skala keine naive LRGB-Noise-Gewichtung durchführen.
9. `count(%)` als Qualitäts-/Warnindikator verwenden, nicht als Gewicht.
10. Deconvolution erst auf dem fertigen SLUM durchführen.
11. RGB-Verarbeitung und SLUM-Verarbeitung als zwei getrennte Pfade behandeln.
12. Belichtungszeit nicht zusätzlich in die Noise-Gewichtung einrechnen, wenn der Noise des fertigen Masters verwendet wird.

Damit ist der gesamte bisherige Ansatz in eine Form gebracht, aus der sich direkt ein PixInsight-Script, ein kleines Desktop/Web-Tool oder eine Funktion in AstroLog/Astro-Forecast ableiten lässt.
