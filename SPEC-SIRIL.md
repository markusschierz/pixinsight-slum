# Spec: SLUM für Siril

**Status:** Entwurf, wartet auf Freigabe.

## Objective

Eine Siril-Version von SLUM erzeugt aus zwei bis vier linearen, registrierten Mastern (L, R, G, B) eine lineare Super-Luminanz. Sie verwendet dieselbe Rechenregel wie die PixInsight-Version: `SLUM = a × L + (1−a) × RGBLUM`, mit `1/noise²`-Gewichtung innerhalb RGB und einem L-Anteil von 20–80 %. Zielgruppe sind Siril-Nutzer mit LRGB-Daten, die den PixInsight-Workflow nicht nutzen.

Beide Versionen werden gemeinsam als v1.1.0 veröffentlicht (ein GitHub-Release mit zwei ZIP-Dateien).

## Assumptions

1. Ziel ist Siril 1.4 oder neuer mit Python-Skript-Unterstützung (`sirilpy`).
2. Die Rechenlogik wird nach Python mit numpy portiert; die JavaScript-Quellen bleiben unverändert.
3. SPFC-Flux entfällt, weil Siril keine äquivalenten SPFC-Metadaten bereitstellt. Es gibt nur den LinearFit-Weg.
4. Das Rauschmaß wird mit einer eigenen Python-Implementierung berechnet (MRS-artiger Wavelet-Schätzer oder Siril-`bgnoise`). Die Werte weichen deshalb leicht von PixInsight ab. Die Wahl wird in Phase Plan per Spike entschieden.
5. Eingaben sind FITS-Dateien oder das aktuell in Siril geladene Bild. Ausgabe ist eine neue 32-Bit-FITS-Datei oder das geladene Siril-Bild.
6. Die UI ist ein kleiner Tkinter-Dialog (in Siril-Python-Skripten üblich).

## Commands

```
Node-Tests (PixInsight):  node --test tests/*.test.cjs
Python-Tests (Siril):     python3 -m unittest discover -s tests/siril -p "test_*.py"
Release bauen:            python3 scripts/build-release.py v1.1.0
```

## Project Structure

```
siril/slum_core.py     → Referenz, Gewichte, Mix (Port von slum-core.js)
siril/slum_stats.py    → Median, Noise, LinearFit
siril/slum_engine.py   → Pipeline: Daten laden, fitten, kombinieren
siril/SLUM.py          → Siril-Skript mit Tkinter-UI
tests/siril/           → Unittests mit synthetischen Daten
packaging/             → INSTALL-Hinweise je Plattform
```

## Code Style

Python 3, PEP 8, reine Funktionen im Kern, Fehler als `ValueError` mit deutschen Meldungen wie in der JS-Version. UI-Texte deutsch.

## Testing Strategy

- Paritätstests: Dieselben Eingaben wie in `tests/core.test.cjs` und `tests/stats.test.cjs` müssen in Python dieselben Referenzen und Gewichte ergeben.
- LinearFit und Noise: Tests mit synthetischen Bildern (bekannter Skalierungsfaktor, bekanntes Rauschen).
- Der Siril-Teil (`sirilpy`-Anbindung, UI) wird nur gekapselt dünn gehalten; ein Test in echtem Siril ist nur manuell möglich, falls Siril installiert ist.
- CI: neuer Job `python-tests`, bestehender Job `node-tests` bleibt Pflicht-Check.

## Boundaries

- Always: Kernlogik mit Tests absichern, Originalbilder nie verändern, Noise-Gewichte wie in SPEC-RGBLUM.md.
- Ask first: neue Abhängigkeiten (astropy, scipy), Änderungen an `.github/workflows`, Änderungen an der PixInsight-Version.
- Never: PixInsight-Verhalten ändern, Sample-Daten committen.

## Success Criteria

1. `python3 -m unittest` läuft grün, inklusive Paritätstests zur JS-Kernlogik.
2. `scripts/build-release.py` erzeugt `SLUM-v1.1.0.zip` (PixInsight) und `SLUM-Siril-v1.1.0.zip`, beide mit Prüfsumme.
3. CI ist grün (`node-tests` und `python-tests`).
4. Das Siril-Skript lädt in Siril ohne Importfehler. Ob ein vollständiger Lauf in Siril getestet werden kann, hängt davon ab, ob Siril lokal verfügbar ist; das wird im Release-Text offen benannt.
5. README und INSTALL-Hinweise beschreiben beide Versionen.

## Open Questions

1. Ist Siril lokal installiert (zum echten Test)? Wenn nicht, bleibt der Siril-Teil ohne Laufzeittest und wird als solcher gekennzeichnet.
2. Soll der Siril-Code im selben Repo liegen (Vorschlag) oder in einem eigenen?
3. Ein gemeinsames Release v1.1.0, wie angenommen?

## Umsetzungsstand (v1.1.0)

- Ausgabe: neue FITS-Datei, optional in Siril öffnen (kein direktes Überschreiben des geladenen Bildes).
- Rauschen: Starlet-MRS-Schätzung durch Sn-Skala normalisiert; absolute Werte weichen von PixInsight ab, Gewichte sind relativ.
- Integrationsproben laufen headless im Siril-Pipe-Modus (`siril -p`, `pyscript`).
- Offene Fragen mit Standardannahmen entschieden: gleiches Repo, gemeinsames Release v1.1.0, kein SPFC.
