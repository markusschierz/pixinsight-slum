# Spezifikation: Behandlung gesättigter Sternränder (abschaltbar)

**Status:** UMGESETZT (Verfahren A, Zonengewichtung über geglättete Sättigungsmaske). Siehe Abschnitt 8. Führendes [Issue #26](https://github.com/markusschierz/pixinsight-slum/issues/26). Ergänzt [SPFC-Spec](spfc.md) und [rgblum.md](rgblum.md); alle dortigen Regeln gelten weiter.

## 1. Ausgangslage (gemessen, nicht vermutet)

Messung in echtem PixInsight mit den vier Flux-Samples des Nutzers (Mediane identisch zu seinen Masters):

- Alle Master sind roh gesättigt. Nach SPFC liegen die Clip-Niveaus bei L 7,11 und R/G/B bei 2,2–2,6.
- Bei normalen Sternen sind altes und neues SLUM praktisch gleich (≤ 4 %). Abweichungen betreffen nur gesättigte Sterne.
- Am Rand gesättigter Sterne (Radius 12 px, Plateau = 1,0): altes SLUM 0,70; dieselben alten Gewichte auf Rohdaten 0,703; SPFC mit L 29 % 0,81; SPFC mit L 66 % 0,94.
- Beitragende Ursachen: (1) SPFC-Flussskala, geklipptes L liegt 3,2× höher als geklipptes RGB; (2) hoher L-Anteil.
- Ein früherer Versuch (L ausblenden, Gewichte renormieren) erzeugte schwarze Ringe und wurde verworfen.

**Nicht gemessen:** Was der Nutzer als „ausgebrannten Ring“ sieht (Donut-Kern, zu großer weißer Stern oder Farbrand). Gesättigte Pixel dürfen gesättigt bleiben; „weicht vom alten SLUM ab“ ist allein kein Fehler.

## 2. Ziel

Der Nutzer kann im Dialog eine **Sternrand-Korrektur** ein- und ausschalten. **Aus** liefert exakt das bisherige Ergebnis. **Ein** verändert nur die gesättigte Randzone und lässt den Rest des Bildes bitgleich.

## 3. Vorgehen in Phasen (jede Phase wird einzeln freigegeben)

**Phase 0 – Sichtbefund (keine Codeänderung).** Ausschnitte um 2–3 gesättigte Sterne aus altem SLUM und aktuellem SLUM mit gleicher Stretch-Kurve rendern; Nutzer bestätigt oder benennt, was der Ring ist. *Verifikation:* Vergleichsbilder liegen vor, Nutzer hat die Art des Artefakts benannt.

**Phase 1 – Messprobe als Regressionstest.** `tests/pjsr-saturation-probe.js` (läuft mit `PixInsight --automation-mode`, Pfad über `SLUM_ROOT`) misst:
1. Randprofil gesättigter Sterne (normiert, Radien 0–32 px),
2. hellste ungesättigte Bereiche (Kerne von Galaxien/Nebeln) und
3. Differenzbild gegen die heutige Mischung.

*Verifikation:* Probe läuft auf dem heutigen Code und liefert die Zahlen aus Abschnitt 1 reproduzierbar.

**Phase 2 – Korrektur gemäß Phase-0-Befund.** Der Algorithmus wird erst nach Phase 0 festgelegt. Kandidaten:
- **A – Zonengewichtung:** In Pixeln, in denen L im Clip ist und RGB deutlich darunter liegt, sinkt der L-Anteil weich auf einen Zielanteil; stetig, ohne Sprünge.
- **B – L-Ersatz:** Geklipptes L wird durch k·RGBLUM auf derselben Flussskala ersetzt, nie unter den heutigen Wert.
- **C – nur Anleitung:** kleineren L-Anteil empfehlen, keine Pixelkorrektur (Fallback, falls A/B die Kriterien nicht erfüllen).

*Verifikation:* Akzeptanzkriterien in Abschnitt 5.

**Phase 3 – UI und Protokoll** (Abschnitt 4), Tests, Doku, Release-Notes.

**Phase 4 – Siril-Port.** Gleiche Option und Probe in `siril/`; getrennte Freigabe.

## 4. UI-Entwurf (PixInsight-Dialog, Gruppe „Mischung“)

```
┌ Mischung ──────────────────────────────────────────────┐
│ L-Anteil            [========|----] 66 %               │
│ RGB-Gewichtung      ( ) Automatisch  ( ) Manuell       │
│                                                        │
│ Sternränder         [ ] Gesättigte Sternränder         │
│                         korrigieren                    │
│                     Gesättigtes L wird am Sternrand    │
│                     zurückgenommen. Aus = bisheriges   │
│                     Ergebnis.                          │
│ Status              Sättigung erkannt: L, R, G, B      │
└────────────────────────────────────────────────────────┘
```

- Neue Zeile unter L-Anteil, gleiche `labelWidth` (150) und 8-pt-Raster wie die übrigen Zeilen.
- Checkbox **standardmäßig aus**; Auswahl wird nicht gespeichert, bleibt aber während einer Dialogsitzung erhalten.
- Nur bedienbar, wenn L unter den Eingaben ist. Ohne L ist sie deaktiviert, die Beschriftung nennt den Grund („nur mit L-Kanal“).
- Während der Ausgabe gesperrt, wie die übrigen Eingaben (`setInputsEnabled`).
- Die Statuszeile zeigt in Textform (nicht nur durch Farbe), in welchen Kanälen nach der Normalisierung Sättigung erkannt wurde.
- Das Protokoll nennt: „Sternrand-Korrektur: aus“ oder „ein (Verfahren …, betroffene Pixel …)“.
- Texte auf Deutsch, Satzfall, kurz, nach den Apple-Design-Prinzipien des Nutzers (Gruppierung, Abstände, keine abgeschnittenen Texte).

## 5. Akzeptanzkriterien

1. **Aus = bitgleich:** Differenzbild zum heutigen SLUM ist überall exakt 0 (Node-Test für den Ausdruck, PJSR-Probe für das Bild).
2. **Ein = lokal:** Außerhalb der Randzone ist die Differenz exakt 0. Die hellsten ungesättigten Bereiche (Kern-Test aus Phase 1) bleiben unverändert.
3. **Keine neuen Löcher:** Kein Pixel der Randzone fällt unter den Wert, den das Ergebnis nur aus dem RGB-Anteil auf L-Skala ergäbe; Profil bleibt vom Kern zum Rand monoton oder gleich dem heutigen Verlauf.
4. **Wirksamkeit:** Die normierte Randhelligkeit gesättigter Sterne nähert sich dem alten SLUM an (Zielwert wird nach Phase 0 mit dem Nutzer festgelegt).
5. Alle bestehenden Node-Tests laufen; neue Tests decken Ausdruck, Optionsübergabe und Protokolltext ab.
6. Keine Änderung an der PixInsight-ZIP-Dateiliste außer den geänderten Quellen.

## 6. Grenzen

- **Immer:** Messen vor Ändern, jede Phase einzeln testen, Originalansichten unverändert lassen.
- **Erst fragen:** Standardwert „an“, neue Parameter jenseits der Checkbox, Änderungen an SPFC- oder Noise-Logik.
- **Nie:** Korrektur ohne Abschaltmöglichkeit, Standardverhalten ungefragt ändern, Tests entfernen.

## 7. Offene Fragen an den Nutzer

1. Was genau ist der Ring (Phase 0)?
2. Soll die Option den Namen „Gesättigte Sternränder korrigieren“ behalten?
3. Soll später der Standard auf „an“ wechseln, wenn die Messung überzeugt?

## 8. Umsetzung und Messung

- Phase 0: Vergleichsbilder zeigen eine zu große weiße Scheibe bei hohem L-Anteil, keinen Donut.
- Verfahren A per Pixel (L/RGB-Verhältnis, RGB-Niveau) ergab dunkle Kernlöcher (Kern 0,47 des Peaks) und wurde verworfen. Ursache: RGB-Kerne sind in den Daten selbst donutförmig.
- Umgesetzt: Maske der gesättigten L-Pixel (≥ 98 % des Clip-Niveaus), Gauß σ = 6 px, Verstärkung 4, gekappt bei 1. L-Anteil = a − (a − 30 %) · Maske. Profile der drei Teststerne fallen monoton nach außen; Hintergrund ist bitgleich.
- Messprobe: `tests/pjsr-saturation-probe.js`, UI-Probe `tests/pjsr-saturation-ui-probe.js`. Siril: gleiche Parameter in `siril/slum_engine.py`.
- Abweichung vom Entwurf: Die Statuszeile „Sättigung erkannt“ steht im Protokoll statt im Dialog, weil die Sättigung erst bei der Normalisierung bekannt ist.
- Offen: Standard bleibt **aus**; Wirkung bitte an eigenen Daten prüfen.
