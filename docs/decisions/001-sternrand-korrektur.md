# ADR 001: Optionale Korrektur gesättigter Sternränder

**Status:** Umgesetzt in v1.2.1 · [Issue #26](https://github.com/markusschierz/pixinsight-slum/issues/26) · ergänzt die [SPFC-Spec](../specs/spfc.md) und die [RGBLUM-Spec](../specs/rgblum.md)

## Kontext

Mit SPFC-Normalisierung und hohem L-Anteil (z. B. 66 %) erschienen gesättigte Sterne größer und weißer als im alten SLUM. Gemessen in PixInsight mit vier realen Mastern:

- Alle Master sind roh gesättigt. Nach SPFC liegt das Clip-Niveau von L bei 7,11, das von R/G/B bei 2,2–2,6 (L also 3,2× höher).
- Normale Sterne weichen kaum ab (≤ 4 %). Betroffen sind nur gesättigte Sterne.
- Randhelligkeit gesättigter Sterne (Radius 12 px): altes SLUM 0,70; SPFC mit L 29 % 0,81; SPFC mit L 66 % 0,94.
- Sichtbefund: zu große weiße Scheibe, kein Donut.
- Ein früherer Versuch, L auszublenden und die Gewichte zu renormieren, erzeugte schwarze Ringe.

Gesättigte Pixel dürfen gesättigt bleiben. „Weicht vom alten SLUM ab“ ist allein kein Fehler.

## Entscheidung

Eine **abschaltbare** Korrektur, Standard **aus**. Aus liefert exakt das bisherige Ergebnis.

Verfahren: Maske der gesättigten L-Pixel (≥ 98 % des Clip-Niveaus), Gauß-Unschärfe σ = 6 px, Verstärkung 4, gekappt bei 1. Der L-Anteil sinkt zonenweise von `a` auf 30 %:
`L-Anteil = a − (a − 0,30) · Maske`.

Im Dialog (Gruppe „Mischung“) gibt es dafür die Checkbox „Gesättigte Sternränder korrigieren“. Sie ist nur mit L bedienbar und während der Ausgabe gesperrt. Das Protokoll nennt „Sättigung erkannt“ und „Sternrand-Korrektur“. Siril verwendet dieselben Parameter (`siril/slum_engine.py`).

## Verworfen

- **Gewichtung pro Pixel** (L/RGB-Verhältnis, RGB-Niveau): erzeugte dunkle Kernlöcher (Kern 0,47 des Peaks), weil die RGB-Kerne in den Daten selbst donutförmig sind.
- **L-Ersatz durch k·RGBLUM:** nicht umgesetzt, die Maskenlösung erfüllte die Kriterien.
- **Nur Anleitung** (kleineren L-Anteil empfehlen): Rückfallebene, nicht nötig.
- **Standard „an“:** nicht ohne Rückfrage; das Standardverhalten bleibt unverändert.

## Folgen

- Hintergrund bleibt bitgleich (0 von 4000 Stichproben verändert), Sternprofile fallen monoton nach außen, Spitze 3,78 statt 5,50.
- Die Statuszeile „Sättigung erkannt“ steht im Protokoll statt im Dialog, weil die Sättigung erst bei der Normalisierung bekannt ist.
- Tests: Klasse `SaturationCorrection` in `tests/siril/test_engine.py`, Ausdruckstests in `tests/core.test.cjs`; PixInsight-Proben `tests/pjsr-saturation-probe.js` und `tests/pjsr-saturation-ui-probe.js`.
- Die Parameter (σ, Verstärkung, Zielanteil) sind an drei Teststernen gemessen, nicht allgemein bewiesen. Wirkung an eigenen Daten prüfen.
