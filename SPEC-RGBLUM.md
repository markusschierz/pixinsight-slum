# Spezifikation: Zweistufige SLUM aus L und RGBLUM

**Status:** Durch den ausdrücklichen Umsetzungsauftrag vom 6. November 2026 fachlich freigegeben. Führendes [Feature-Issue #13](https://github.com/markusschierz/pixinsight-slum/issues/13). Ergänzt [SPEC.md](SPEC.md) und [SPEC-SPFC.md](SPEC-SPFC.md). Die bisherige Gewichtsregel für LRGB wird nur an der hier beschriebenen Stelle ersetzt.

**Aktuelle Erweiterung:** Die freigegebene automatische RGB-Gewichtung und die vollständige UI-Nachschärfung werden im führenden Issue #13 geführt. Die frühere Gruppen-Slider-Variante aus [Issue #15](https://github.com/markusschierz/pixinsight-slum/issues/15) wird dadurch ersetzt.

## Zielgruppe und Problem

Astrofotografierende sollen der echten Luminanz in einer SLUM bewusst mehr Einfluss geben können. Die bisherige inverse Noise-Gewichtung über alle vier gleich gesampelten Kanäle ergab mit den realen SPFC-Beispielen L 28,675 % und zusammen RGB 71,325 %. Das minimiert geschätztes Rauschen, bildet aber nicht die gewünschte L-dominierte Mischung ab.

## Verhalten und Nutzungsablauf

1. Sobald L und mindestens einer der Farbkanäle R/G/B ausgewählt sind, entsteht zuerst eine **logische RGB-Luminanz** `RGBLUM` aus genau den gewählten Farbkanälen. Sie wird nicht als zusätzliche Datei oder Ansicht ausgegeben. Standardmäßig werden R/G/B nach der gewählten SPFC- oder LinearFit-Normalisierung anhand ihrer endgültigen Noise-Werte mit `1/noise²` gewichtet. Dies gilt auch bei unterschiedlichem nativem Sampling auf demselben registrierten Ausgaberaster; dort ist das Ergebnis ausdrücklich eine Heuristik und kein allgemeingültiges Auflösungsoptimum.
2. Optional kann der Nutzer die RGBLUM-internen **Kanalgewichte** manuell übersteuern. Alle gewählten Farbkanäle erhalten Werte von 0 bis 100 %, deren Summe 100 % beträgt. Der letzte gewählte Farbkanal erhält automatisch den Rest. Der manuelle Modus ersetzt die automatische RGB-Gewichtung vollständig, ändert aber weder den L-Anteil noch die Normalisierung und Noise-Messung. Natives Sampling jedes Masters bleibt anzugeben und zu prüfen; das Skript resampelt nicht.
3. Das Ergebnis ist `SLUM = a × L + (1−a) × RGBLUM`. `a` ist einschließlich der Grenzen von **0,50 bis 0,80** in 0,01-Schritten wählbar, Startwert **0,70**. Der endgültige Anteil von L ist exakt `a`; die Farbkanäle teilen `1−a` nach ihren normierten RGBLUM-Gewichten. Die Endgewichte summieren sich zu 1.
4. Bei einer Auswahl **ohne L** gelten dieselben automatischen oder manuell übersteuerten RGB-Kanalgewichte direkt für SLUM; die L-Anteil-Steuerung erscheint nicht. Mit L und nur einem Farbkanal ist dieser Kanal `RGBLUM` mit internem Gewicht 1.
5. Der L-Anteil und die Wahl Auto/Manuell samt manuellen RGB-Werten lassen sich nach der Analyse ohne erneutes Laden, LinearFit, SPFC-Skalierung oder NoiseEvaluation ändern. Normalisierung, Noise und Kombination laufen weiter erst bei „SLUM erstellen“. Das Ergebnisprotokoll nennt Gewichtungsmodus, Noise, `a`, die RGBLUM-internen und endgültigen Kanalgewichte.
6. Datei- und Ansichtsquellen, SPFC-Vorrang und ausdrücklicher LinearFit-Fallback, Referenz-Override, registriertes Raster, Originalschutz, beide Ausgabearten, 32-Bit-Float ohne Rescaling, Abbruch/Cleanup und `count(%)`-Warnungen bleiben erhalten.

## UI-Design

Der native PixInsight-Dialog folgt **Bilder → Analysieren → Normalisierung → Gewichtung → Ausgabe**. Der L-Anteil erscheint bei L plus Farbkanal als beschrifteter Slider `50…80`, initial `70`, ohne zusätzlichen RGBLUM-Resttext. Der Abschnitt **„RGB-Sampling-Gewichtung“** zeigt standardmäßig **„Automatisch (Noise bei Ausgabe)“**; eine zusätzliche Auto-Statuszeile entfällt. Die Heuristik bei gemischtem Sampling wird im Tooltip und in der Dokumentation erklärt. Die Option **„Manuell“** blendet eine nebeneinanderliegende Zeile `R [0–100 %]  G [0–100 %]  B [berechnet]` ein; bei einer Teilmenge erscheinen nur ihre gewählten Kanäle und der letzte erhält den Rest. Leere, ungültige und in Summe über 100 % liegende Eingaben sperren die Ausgabe mit einem nahen, konkreten Grund. Bei nur einem Farbkanal ist dessen Gewicht 100 % und die manuelle Wahl entfällt. Die Ergebnisübersicht zeigt Gewichte und Ausgabeziel, technische Details bleiben im scrollbaren Protokoll. Dateipfade sind vollständig per Tooltip erreichbar, der Ansichten-Aktualisieren-Knopf ist beschriftet und „Schließen“ wird während eines Laufs zu „Abbrechen“. Die bisherigen Bestätigungs-Checkboxen für Bildvorbedingungen und unsichere WCS-Daten entfallen. Die Vorbedingungen stehen im Dialog; Abmessungsfehler und deutliche WCS-Versätze bleiben harte Fehler, unklare WCS werden im Protokoll genannt. PixInsights native Controls, Tastaturführung und Theme bleiben maßgeblich.

## Nicht-Ziele

- Eine zusätzlich sichtbare oder gespeicherte RGBLUM-Ansicht/-Datei.
- Eine aus Noise automatisch gewählte **L/RGB-Quote**, ein L-Anteil außerhalb 20–80 % oder eine behauptete optimale Auflösungsgewichtung bei gemischtem Binning.
- Änderung der SPFC-/LinearFit-Normalisierung oder Vorverlagerung der rechenintensiven Schritte in die Analyse.

## Prüfbarkeit und Risiken

1. LRGB mit gleichem Sampling und `a=0,70`: `wL=0,70`, `wR+wG+wB=0,30`, RGB-Anteile folgen `1/noise²`; Ausgabepixel entsprechen der zweistufigen Formel.
2. Die Randwerte `0,50` und `0,80` funktionieren; außerhalb des Bereichs, NaN oder fehlende Werte werden abgewiesen. Ein Sliderwechsel verwendet die bestehende Analyse und löst keine Normalisierung/NoiseEvaluation aus.
3. L plus Teilmenge, einschließlich nur eines Farbkanals, funktioniert. RGB ohne L hat dieselbe Auto-/Manuell-Wahl; die L-Steuerung bleibt verborgen.
4. L 2×2 mit R/G/B 3×3 sowie gemischte Sampling-Werte **innerhalb von RGB** führen ohne Gruppen-Slider zum Ergebnis. Automatische Gewichte folgen den nach der Ausgabe-Normalisierung gemessenen Noise-Werten; der gemischte Fall wird als Heuristik gekennzeichnet.
5. Manuelle Gewichte `R=40 %, G=35 %, B=25 %` ergeben bei `a=0,70` endgültig `L=70 %, R=12 %, G=10,5 %, B=7,5 %`. 0/100-Grenzen, fehlende Werte und Summen über 100 % werden geprüft; der letzte Kanal wird berechnet. Ein Moduswechsel nach Analyse führt keine teure Berechnung aus.
6. Beide Normalisierungswege, Datei-/Ansichtseingabe und -ausgabe, Originalschutz, Fehlermeldungen und Cleanup bestehen die Regression. Der überarbeitete Dialog wird für Start, Analyse, Auto, Manuell, Fehler und Erfolg nativ gerendert.

**Risiko:** Ein alter Gruppenanteil darf nicht zusätzlich wirken. Auto und Manuell müssen denselben kanonischen Pfad verwenden. Bei gemischtem Sampling können Noise-Werte durch unterschiedliche Auflösung und Resampling beeinflusst sein; der Modus wird deshalb als Heuristik offengelegt und manuell übersteuerbar gemacht.

**Offene fachliche Entscheidungen:** keine. Startwert 70 % folgt dem vorher diskutierten Beispiel und ist jederzeit veränderbar.
