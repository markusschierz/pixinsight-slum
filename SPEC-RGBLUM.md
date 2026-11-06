# Spezifikation: Zweistufige SLUM aus L und RGBLUM

**Status:** Durch den ausdrücklichen Umsetzungsauftrag vom 6. November 2026 fachlich freigegeben. Führendes [Feature-Issue #13](https://github.com/markusschierz/pixinsight-slum/issues/13). Ergänzt [SPEC.md](SPEC.md) und [SPEC-SPFC.md](SPEC-SPFC.md). Die bisherige Gewichtsregel für LRGB wird nur an der hier beschriebenen Stelle ersetzt.

## Zielgruppe und Problem

Astrofotografierende sollen der echten Luminanz in einer SLUM bewusst mehr Einfluss geben können. Die bisherige inverse Noise-Gewichtung über alle vier gleich gesampelten Kanäle ergab mit den realen SPFC-Beispielen L 28,675 % und zusammen RGB 71,325 %. Das minimiert geschätztes Rauschen, bildet aber nicht die gewünschte L-dominierte Mischung ab.

## Verhalten und Nutzungsablauf

1. Sobald L und mindestens einer der Farbkanäle R/G/B ausgewählt sind, entsteht zuerst eine **logische RGB-Luminanz** `RGBLUM` aus genau den gewählten Farbkanälen. Sie wird nicht als zusätzliche Datei oder Ansicht ausgegeben. Innerhalb einer Sampling-Gruppe gelten die bestehenden `1/noise²`-Gewichte nach der gewählten SPFC- oder LinearFit-Normalisierung.
2. Haben die gewählten Farbkanäle unterschiedliche native Sampling-Werte, legt der Nutzer die Anteile **zwischen diesen RGB-Sampling-Gruppen** wie bisher ausdrücklich fest; die Summe ist 100 %. L ist kein Mitglied dieser Gruppen. Bei einer RGB-Gruppe entfällt diese Eingabe.
3. Das Ergebnis ist `SLUM = a × L + (1−a) × RGBLUM`. `a` ist einschließlich der Grenzen von **0,50 bis 0,80** in 0,01-Schritten wählbar, Startwert **0,70**. Der endgültige Anteil von L ist exakt `a`; die Farbkanäle teilen `1−a` nach ihren normierten RGBLUM-Gewichten. Die Endgewichte summieren sich zu 1.
4. Bei einer Auswahl **ohne L** bleibt die bisherige Noise-/Sampling-Gruppengewichtung unverändert. Die L-Anteil-Steuerung erscheint nicht. Mit L und nur einem Farbkanal ist dieser Kanal `RGBLUM` mit internem Gewicht 1.
5. Der L-Anteil und die RGB-Gruppenanteile lassen sich nach der Analyse ohne erneutes Laden, LinearFit, SPFC-Skalierung oder NoiseEvaluation ändern. Normalisierung, Noise und Kombination laufen weiter erst bei „SLUM erstellen“. Der Dialog erklärt die zwei Stufen und zeigt nach der Ausgabe `a`, die RGBLUM-internen Gewichte sowie alle endgültigen Kanalgewichte.
6. Datei- und Ansichtsquellen, SPFC-Vorrang und ausdrücklicher LinearFit-Fallback, Referenz-Override, registriertes Raster, Originalschutz, beide Ausgabearten, 32-Bit-Float ohne Rescaling, Abbruch/Cleanup und `count(%)`-Warnungen bleiben erhalten.

## UI-Design

Der native PixInsight-Dialog zeigt nach der Analyse und nur bei einer Auswahl mit L den beschrifteten NumericControl **„L-Anteil an SLUM“** mit Slider und editierbarer Prozentzahl `50…80`, initial `70`. Ein Text daneben erläutert: **„RGBLUM erhält den Rest; R/G/B werden darin nach Noise gewichtet.“** Bei mehreren RGB-Sampling-Gruppen folgt darunter die bestehende Gruppe-Anteil-Eingabe mit der Überschrift **„Anteile innerhalb RGBLUM (zusammen 100 %)“**. Die Zusammenfassung nennt vor der Ausgabe `L 70 % + RGBLUM 30 %`; endgültige Noise- und Kanalgewichte erscheinen erst nach der Ausgabe. Bei fehlendem oder ungültigem Sampling bzw. unvollständigen RGB-Gruppenanteilen bleibt „SLUM erstellen“ gesperrt.

## Nicht-Ziele

- Eine zusätzlich sichtbare oder gespeicherte RGBLUM-Ansicht/-Datei.
- Eine aus Noise automatisch gewählte L/RGB-Gruppenquote, manuelle Einzelgewichte für R/G/B oder ein L-Anteil außerhalb 50–80 %.
- Änderung der SPFC-/LinearFit-Normalisierung oder Vorverlagerung der rechenintensiven Schritte in die Analyse.

## Prüfbarkeit und Risiken

1. LRGB mit gleichem Sampling und `a=0,70`: `wL=0,70`, `wR+wG+wB=0,30`, RGB-Anteile folgen `1/noise²`; Ausgabepixel entsprechen der zweistufigen Formel.
2. Die Randwerte `0,50` und `0,80` funktionieren; außerhalb des Bereichs, NaN oder fehlende Werte werden abgewiesen. Ein Sliderwechsel verwendet die bestehende Analyse und löst keine Normalisierung/NoiseEvaluation aus.
3. L plus Teilmenge, einschließlich nur eines Farbkanals, funktioniert. RGB ohne L folgt nachweislich der alten Gewichtung; die L-Steuerung bleibt verborgen.
4. Bei L 1×1 und RGB 2×2 braucht es keine zweite L/RGB-Gruppenquote. Haben die Farbkanäle untereinander verschiedene Sampling-Gruppen, bleiben deren Anteile erforderlich und beziehen sich ausschließlich auf RGBLUM.
5. Beide Normalisierungswege, Datei-/Ansichtseingabe und -ausgabe, Originalschutz, Fehlermeldungen und Cleanup bestehen die Regression. Ergebnisprotokoll nennt die tatsächlich verwendeten zwei Stufen und Endgewichte.

**Risiko:** Ein gleichzeitig wirksamer alter Gruppenanteil und `a` würde L doppelt gewichten. Die Gruppenbildung muss deshalb bei vorhandenem L allein die Farbkanäle umfassen; eine einzige kanonische Gewichtsberechnung wird von Vorschauvalidierung und Ausgabe verwendet.

**Offene fachliche Entscheidungen:** keine. Startwert 70 % folgt dem vorher diskutierten Beispiel und ist jederzeit veränderbar.
