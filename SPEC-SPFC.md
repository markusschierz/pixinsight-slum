# Spezifikation: SPFC-Flux als bevorzugte SLUM-Normalisierung

**Status:** Fachlich freigegeben am 6. November 2026. Führendes [Feature-Issue #11](https://github.com/markusschierz/pixinsight-slum/issues/11). Ergänzt die [bestehende SLUM-Spec](SPEC.md); deren Eingabe-, Sampling-, Gewichts-, Ausgabe- und Originalschutzregeln gelten weiter. Grundlage ist die lokale Wunschliste `SLUM-withSPFC.md`.

## Zielgruppe, Problem und Ziel

Astrofotografierende sollen aus bereits vorbereiteten linearen L/R/G/B-Mastern eine SLUM mit vergleichbarer Signalskala erzeugen. Die heutige Anwendung normalisiert alle Eingaben ausschließlich mit LinearFit. Wenn für **alle** gewählten Kanäle nachweislich geeignete SPFC-Flux-Kalibrationsdaten vorliegen, soll stattdessen eine einheitliche Flux-Normalisierung verwendet werden. LinearFit bleibt als ausdrücklich gewählter Fallback erhalten.

## Fachlicher Umfang

1. Die Analyse zeigt für jeden gewählten Datei- oder Ansichts-Kanal einen verständlichen SPFC-Status: gültig, fehlend oder ungültig/unvollständig, jeweils mit Grund. Ein bloßer SPFC-Vermerk reicht nicht als Gültigkeitsnachweis. Die Analyse führt weiterhin weder Normalisierung noch NoiseEvaluation aus.
2. Sind die Daten für **alle** gewählten Kanäle gültig und untereinander vergleichbar, ist SPFC der bevorzugte Normalisierungsweg. Alle Kanäle verwenden dieselbe nachgewiesene Flux-Regel; LinearFit wird in diesem SLUM-Lauf nicht ausgeführt.
3. Fehlt eine vollständige gültige SPFC-Kalibration, empfiehlt der Dialog, SPFC außerhalb des Skripts nachzuholen und anschließend neu zu analysieren. Für eine Ausgabe ohne SPFC muss der Nutzer **LinearFit als Fallback ausdrücklich wählen**. Eine gemischte Normalisierung innerhalb eines Ergebnisses ist ausgeschlossen.
4. Im LinearFit-Fallback ist bei jeder Auswahl **mit L** zunächst L als Referenz vorgeschlagen. Ohne L gilt der niedrigste gültige Median der gewählten Kanäle als Vorschlag. In beiden Fällen darf der Nutzer **jeden anderen ausgewählten Kanal** als Referenz wählen; die tatsächliche Wahl wird für den Fit verwendet und protokolliert.
5. NoiseEvaluation läuft erst bei Datei- oder Ansichtsausgabe und auf genau den normalisierten Arbeitsbildern, die anschließend kombiniert werden. Die bestehende Gewichtung `1/noise²` innerhalb gleicher Sampling-Gruppen, die ausdrücklich festgelegten Anteile zwischen Gruppen, `count(%)`-Warnungen, 32-Bit-Float-Ausgabe ohne Rescaling sowie Originalschutz und Cleanup gelten unverändert.

## Dialog- und Nutzungsabläufe

Der bestehende native PixInsight-Dialog bleibt der Bedienort. Eine klar beschriftete Verfahrensanzeige und Textstatus je gewähltem Kanal machen die Entscheidung sichtbar; Farbe allein vermittelt keinen Status. Die LinearFit-Referenzwahl ist nur im Fallback relevant und darf die Analyse nicht erneut starten.

- **Vollständiges SPFC:** Nach der Analyse sieht der Nutzer „SPFC-Flux“ als vorgesehenes Verfahren und kann nach den bisherigen Vorbedingungen die SLUM-Ausgabe starten. Fortschritt und Ergebnisprotokoll benennen SPFC.
- **SPFC fehlt oder ist ungültig:** Der Dialog benennt die betroffenen Kanäle und den Grund. Er erklärt „SPFC außerhalb des Skripts nachholen, danach erneut analysieren“ und bietet die bewusste Wahl „LinearFit verwenden“. Bis zu dieser Wahl ist „SLUM erstellen“ gesperrt. Eine externe Änderung der Quellen erfordert eine neue Analyse.
- **LinearFit-Fallback:** Der Dialog zeigt Vorschlag und tatsächliche Referenz. L wird bei vorhandener L-Eingabe vorgeschlagen, kann aber übersteuert werden. Der Nutzer kann bis zur Ausgabe ohne erneute Fit- oder Noise-Berechnung wechseln.
- **Ausgabe/Fehler:** Während der Berechnung sind Verfahren und Fortschritt erkennbar. Eine ungültige Kalibration oder ein ungültiger Noise-Wert stoppt den Lauf mit konkretem Grund; Originale bleiben erhalten, temporäre Daten werden entfernt. Das Erfolgsprotokoll nennt Verfahren, maßgebliche Kalibrationswerte oder Fit-Referenz, Noise, `count(%)`, Gewichte und Datei- oder Ansichts-ID.

Der Ablauf funktioniert für zwei bis vier gewählte Kanäle, gemischte Datei-/Ansichtsquellen, einheitliches oder gemischtes natives Sampling sowie beide vorhandenen Ausgabearten.

## Nicht-Ziele

- SPFC im SLUM-Skript ausführen oder eine externe SPFC-Sitzung steuern.
- Fehlende Kalibration schätzen, SPFC und LinearFit kanalweise mischen oder aus einem Metadaten-Label allein einen Flux-Faktor ableiten.
- Registrierung, Resampling, Gradientenentfernung, MGC, Farbkalibrierung oder die bestehende Gewichtungsformel ändern.

## Prüfbarkeit und Abnahme

1. Vollständig gültige und vergleichbare SPFC-Daten führen für alle gewählten Kanäle zur nachgewiesenen Flux-Normalisierung ohne LinearFit. Die Ausgabepixel und Noise-Werte beziehen sich auf diese Bildversionen.
2. Ein fehlender, unvollständiger, nicht endlicher oder nicht vergleichbarer Kalibrationswert verhindert den SPFC-Weg. Der Dialog benennt Kanal und Ursache; ohne ausdrücklich gewählten Fallback entsteht keine SLUM.
3. Für LRGB oder eine Teilmenge mit L schlägt LinearFit L vor; ein Override auf einen anderen gewählten Kanal wird tatsächlich angewendet. Für RGB ohne L gilt die Medianempfehlung mit demselben Override. Die Referenzwahl startet keine erneute Analyse.
4. Nach der jeweiligen Normalisierung wird Noise genau auf den kombinierten Arbeitsbildern gemessen. Kanalgewichte, Sampling-Gruppen und Gruppenanteile folgen unverändert der bestehenden Spec. Das Protokoll nennt das tatsächlich verwendete Verfahren und die Endwerte.
5. Datei- und Ansichtsquellen sowie XISF- und SLUM-Ansichtsausgabe funktionieren. Originaldateien und ursprüngliche Ansichten bleiben unverändert; Abbruch und Fehler hinterlassen kein Teilergebnis.
6. **Fachliche Freigabegrenze für den SPFC-Weg:** Für die unterstützte PixInsight-Version sind die konkreten Metadaten, ihre Gültigkeit, die Bedeutung des Flux-/Scale-Werts, die mathematische Anwendung auf Pixel und Noise sowie der Fall bereits angewendeter Kalibration anhand geeigneter PixInsight-Daten nachvollziehbar belegt. Ohne diesen Nachweis darf keine automatische Flux-Skalierung freigeschaltet und die SPFC-Fähigkeit nicht als abgenommen bezeichnet werden.

## Risiken und offene Punkte

Ein falsch verstandener Faktor könnte Pixel doppelt skalieren und damit die Noise-Gewichtung verfälschen. Metadaten einer geladenen Ansicht können zudem vom aktuellen Pixelzustand abweichen. Beide Fälle verlangen eine belastbare Gültigkeitsprüfung statt einer stillen Annahme.

**Offene fachliche Entscheidungen:** keine. Die Referenz-Übersteuerung wurde ausdrücklich bestätigt. **Offener technischer Nachweis:** PixInsight-SPFC-Metadaten, Faktor und Anwendung einschließlich bereits kalibrierter Pixel gemäß Akzeptanzkriterium 6. Er wird durch Quellen und geeignete Beispieldaten geklärt; er ist keine Rückfrage an den Nutzer und keine Erlaubnis für eine unbelegte Skalierung.
