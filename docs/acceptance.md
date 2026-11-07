# SLUM-MVP: Abnahmeprotokoll

**Stand:** 7. November 2026 · PixInsight Core 1.9.6 Lockhart, PJSR V8 · ursprüngliches Issue [#1](https://github.com/markusschierz/pixinsight-slum/issues/1), aktuelles Gewichtungs-Issue [#13](https://github.com/markusschierz/pixinsight-slum/issues/13)

Die bisherigen Abschnitte dokumentieren die jeweilige frühere Version einschließlich der später abgelösten Gruppen-Slider. Die aktuelle Auto-/Manuell-Regel folgt der [RGBLUM-Erweiterung](specs/rgblum.md) und ist im letzten Abschnitt geprüft.

## Verifizierte Fälle

| Fall | Ergebnis |
| --- | --- |
| Gemeinsamer gültiger Median | Synthetische Probe mit schwarzen und gesättigten Pixeln: R `0,5`, B `0,4` (32-Bit-Rundung); PixelMath-Maske und PixInsights nativer Median. |
| NoiseEvaluation | Synthetische Probe: installiertes NoiseEvaluation 2.1.1 und Skript liefern exakt `1,180153512943706`, `count 99,871826171875 %`, 4 MRS-Ebenen. |
| Reale LRGB-Stacks | 9355 × 6252, je 32-Bit-Float-FITS; niedrigster Median bei B `0,015413154847919941`, daher automatische Referenz B. Endgewichte L `0,2868232825710445`, R `0,24307373173615152`, G `0,23607084193413486`, B `0,23403214375866926`; Summe 1. |
| Verschobener LinearFit-Zeitpunkt | Reale LRGB-Stacks: Analyse 3,855 s ohne Fit/Noise, Referenzwechsel unter 1 ms, Ausgabe mit Fit/Noise/XISF 44,248 s. Synthetische Probe bestätigt unbearbeitete Arbeitsbilder nach Analyse, keine Noise-Werte vor Ausgabe, dieselben Arbeitsbilder nach Referenzwechsel und Ergebnisse erst nach Erzeugung. |
| Reale RGB-Teilmenge mit Override | B empfohlen, R manuell gewählt. Endgewichte R `0,34082733543922766`, G `0,33103429429595593`, B `0,3281383702648165`. |
| XISF-Ausgabe | Öffnet mit 9355 × 6252, einem Graukanal und 32-Bit-Float. Pixel (4000,3000): erwartet `0,015424550178759037`, gespeichert `0,015424550510942936`; Differenz entspricht Float32-Rundung. |
| Gemischtes Sampling | Synthetischer L-1×1/RGB-2×2-Fall: bestätigter Testanteil L `0,7`, RGB zusammen `0,3`; endgültige Gewichte summieren sich zu 1, Ausgabepixel differiert um `1,93e-10`. Es gibt keinen voreingestellten Gruppenanteil. |
| Originalschutz | SHA-256 aller vier FITS-Dateien vor/nach realen LRGB- und RGB-Läufen identisch. Eine vor dem Lauf geöffnete R-Ansicht blieb geöffnet, derselbe Pixelwert und derselbe `isModified`-Status. |
| Datei-/Ansichtsquellen | Synthetische Probe mit L als Datei und R als geladener Hauptansicht sowie L/R nur als Ansichten. Der gemischte Ausgabepixel stimmt mit der gewichteten Summe überein. Beide Originalansichten blieben geöffnet; Pixel und `isModified` blieben gleich. Dieselbe Datei und ihre geladene Ansicht werden als doppelte Quelle abgewiesen. |
| Reale Datei-/Ansichtskombination | L als FITS-Datei, R als bereits geöffnete FITS-Ansicht: Referenz R, XISF `9355 × 6252`, 32-Bit-Float; Pixeldifferenz zur gewichteten Summe `1,05e-10`. R blieb geöffnet, Pixel und `isModified` unverändert; SHA-256 aller vier Quelldateien blieb gleich. |
| Ansichtswechsel im Dialog | Der Wechsel auf eine andere geladene Ansicht schließt temporäre Arbeitsfenster, sperrt die Ausgabe und verlangt eine neue Analyse. Die Ansichtsliste und die gemischte Dateiansicht wurden nativ gerendert. |
| SLUM-Ansicht als Ausgabe | Native Probe: neue `SLUM`-Ansicht bleibt nach Cleanup und Dialogende erhalten, 1 Graukanal mit 32-Bit-Float, Pixelabweichung `0`, keine XISF-Datei. Bei bereits belegter ID entsteht `SLUM_1`. Abbruch vor der Ausgabe entfernt das berechnete Ergebnis und alle Arbeitsfenster. Quellansichten behalten Pixel und `isModified`. Der Dialog aktiviert den Ansichtsmodus ohne XISF-Ziel; Layout wurde gerendert. |
| Fehler und Abbruch | Ein Kanal, doppelte Dateipfade und Dateialias, verschiedene Maße, abweichende WCS, fehlendes Sampling, Anteile ungleich 100 %, unbestätigtes Raster und vorhandenes Ausgabeziel werden abgewiesen. Abbruch bei Analyse sowie nach temporärer XISF-Erzeugung hinterlässt keine Ausgabe, keine Teildatei und keine Arbeitsansicht. |
| Dialog | Native PixInsight-Oberfläche gerendert; ohne Anteile/Vorbedingungen/Rasterbestätigung ist „SLUM erstellen“ gesperrt. Referenz-Override verwendet die bestehende Analyse; Anteile bleiben erhalten. XISF-Dateimodus besteht nach der Ausgabemodus-Ergänzung die bestehende Dialogprobe. `count(%)`-Warnschwellen bei 25 % und 50 % sind durch Tests abgedeckt; Warnungen erscheinen nach der Ausgabe. |

Die vier realen FITS-Header enthalten keine WCS-Lösung und laut Header jeweils 1×1-Binning. Deshalb verlangt das Skript vor ihrer Ausgabe die ausdrückliche Bestätigung des gemeinsamen registrierten Rasters. Ein realer 2×2-Master wurde nicht bereitgestellt; der Mischfall wurde mit synthetischen, auf dasselbe Raster gelegten XISF-Daten geprüft. Die Ansichtsauswahl wurde zusätzlich mit einer real geöffneten R-FITS-Ansicht geprüft.

**Manuelle Gesamtabnahme abgeschlossen:** Der Nutzer hat am 6. November 2026 bestätigt, dass die Tab-Navigation im PixInsight-Dialog in Ordnung ist. Die automatisierte PixInsight-Sitzung konnte keine echten Tab-Ereignisse senden; die Fensterdarstellung und die aktivierten/gesperrten Zustände wurden zusätzlich automatisiert geprüft.

## SPFC-Ergänzung (Issue #11)

Die [technische Evidenz](technik.md#spfc-nachweis) dokumentiert PixInsights Metadaten und die bitgleichen Pixelpaare aus den vier realen SPFC-Dateien. Der SPFC-Weg skaliert temporäre Kopien einmalig mit dem kanalbezogenen `ScaleFactors[0]`; die gemeinsame `NormalizationFactor`-Normierung ist für alle Eingaben gleich.

| Fall | Ergebnis |
| --- | --- |
| LRGB mit Datei-/Ansichtsmischung | L als geöffnete XISF-Ansicht, RGB als Dateien: alle vier SPFC-Werte gültig, SPFC automatisch gewählt. Neue `SLUM`-Ansicht, Pixel (4000,3000) `0,05947371944785118` gegenüber unabhängig berechnet `0,05947371879387232` (Float32-Differenz `6,54e-10`). L-Originalpixel unverändert. |
| RGB ohne L als XISF | SPFC automatisch gewählt, niedrigster Median B als spätere Fallback-Empfehlung. Gespeicherte XISF wieder geöffnet; Pixeldifferenz `7,70e-10`. Temporäre Datei entfernt. |
| Unvollständiges SPFC und Fallback | Reale FITS-Eingaben ohne SPFC: Kanalursache „Skalierungsfaktor fehlt“, Methode leer, „SLUM erstellen“ gesperrt. Erst „LinearFit verwenden“ aktiviert die Ausgabe. Bei L/R wird L vorgeschlagen; manueller Wechsel auf R nutzt dieselbe Analyse. |
| Bestehender LinearFit-Pfad | Native Engine- und Dialogregression: gemischtes Sampling mit Anteilen 70/30, korrekte Pixel, Warn-/Bestätigungszustände, Abbruch ohne Datei/Teildatei/Arbeitsansicht. Node-Tests und JS-Syntaxprüfung bestanden. |
| WCS der SPFC-Beispiele | Kleine Abweichungen unabhängiger Plate Solves lösen die ausdrückliche Rasterbestätigung aus. Ein Versatz über zwei Ausgabepixel bleibt ein Fehler. |

Die visuelle Dialogprobe zeigt SPFC als ausgewähltes Verfahren, die Kanalwerte als Text, die gesperrte LinearFit-Referenz und die bestätigungspflichtige Registrierung. Die Tastaturreihenfolge der neu hinzugekommenen Methodenauswahl wurde in einer interaktiven PixInsight-Sitzung noch nicht manuell geprüft.

## Zweistufige RGBLUM-Gewichtung (Issue #13)

| Fall | Ergebnis |
| --- | --- |
| SPFC-LRGB als Ansicht | Reale Flux-Beispiele, `a=0,65`: Endgewichte L `0,65`, R `0,1192977515`, G `0,1158623027`, B `0,1148399458`; RGB zusammen `0,35`. Ausgabepixel `0,08850366622209549` gegenüber unabhängig berechnet `0,08850366413146869` (Float32-Differenz `2,09e-9`). L-Originalpixel unverändert. |
| RGB ohne L als Datei | Reale Flux-Beispiele: bestehende RGB-Gewichtung unverändert; gespeicherte XISF wieder geöffnet, Pixelabweichung `7,70e-10`. |
| LinearFit, L 1×1 und RGB 2×2 | Synthetische XISF-Probe mit `a=0,60`: L `0,60`, RGB zusammen `0,40`; keine zusätzliche L/RGB-Gruppeneingabe. XISF-Pixelabweichung `3,63e-10`. |
| LinearFit, verschiedene RGB-Gruppen | Synthetische Ansichtsprobe mit L/R 1×1, G/B 2×2, `a=0,70` und RGB-Gruppenanteilen 40/60: L `0,70`, RGB `0,30`, R `0,12`, G+B `0,18`. Unabhängig berechneter Pixelwert weicht um `3,35e-10` ab. Quellpixel unverändert. Dialog zeigt nur die zwei RGB-Gruppen und die zweistufige Zusammenfassung. |
| Dialog und aufgeschobene Berechnung | Native UI-Probe: L-Slider auf 80 %, dieselbe Analyseinstanz, Noise noch nicht gemessen, Zusammenfassung `80 % L + 20 % RGBLUM`; LinearFit-Override bleibt ohne Neuanalyse möglich. RGB-only-Dialogregression und LinearFit-Ansichtsprobe bestanden. |

Die Abnahme umfasst Node-Tests der Grenzwerte 50/80 %, ungültiger Werte, L mit einem Farbkanal, RGB-only und gemischter RGB-Gruppen sowie native PixInsight-Proben für SPFC und LinearFit. Das neue UI wurde als PixInsight-Dialog gerendert und visuell geprüft.

### Gruppen-Slider und Bin 3×3

Die native Probe mit **L 2×2 und R/G/B 3×3** liest die Sampling-Werte aus den synthetischen XISF-Headern, zeigt eine einzige RGB-Gruppe und verlangt keinen Gruppenanteil. Bei `a=0,60` entstehen L `0,60` und RGB zusammen `0,40`; die XISF-Pixelabweichung beträgt `3,63e-10`. Die native Dialogprobe zeigt den erklärenden Text und eine freigegebene Ausgabe ohne Gruppen-Slider.

Bei **zwei verschiedenen RGB-Gruppen** ersetzt ein Prozent-Slider die zwei Textfelder: R 1×1 erhält 40 % von RGBLUM, G/B 2×2 automatisch 60 %. Die Zusammenfassung weist für `a=0,70` außerdem 12 % beziehungsweise 18 % an der fertigen SLUM aus. Bei **drei RGB-Gruppen** erzeugen zwei Slider die Aufteilung 30/40/30; beim Überschreiten von 100 % wird der andere Slider automatisch begrenzt. Ohne ausdrückliche Slider-Bewegung bleibt die Ausgabe bei mehreren Gruppen gesperrt. RGB-only-Dateiausgabe, Datei-/Ansichtsmischung, Referenzwechsel ohne Neuanalyse und unveränderte Originale wurden erneut nativ geprüft.

## Aktuelle Auto-/Manuell-Gewichtung und UI-Audit (Issue #13)

Die Gruppen-Slider-Regel des vorherigen Abschnitts ist abgelöst. Die aktuellen Gewichte werden für jeden gewählten RGB-Kanal direkt aus dem Noise nach der Normalisierung ermittelt. Bei gemischtem Sampling nennt der Dialog das Ergebnis eine Heuristik; eine manuelle Übersteuerung ist möglich.

| Fall | Ergebnis |
| --- | --- |
| Auto mit gemischtem RGB-Sampling | Synthetische Ansichten L/R 1×1, G/B 2×2 und im Dialog B auf 3×3: L `0,70`, RGB zusammen `0,30`; RGB-Anteile entsprechen `1/noise²` über alle drei Farbkanäle. Pixelabweichung `3,73e-10`, L-Originalpixel unverändert. Auto ist ohne Gruppenaktion bereit, Noise wird erst bei der Ausgabe gemessen. |
| Manueller Override | R `40 %`, G `35 %`, B automatisch `25 %` innerhalb RGBLUM. Endgewichte L `0,70`, R `0,12`, G `0,105`, B `0,075`; Pixelabweichung `3,35e-10`, L-Originalpixel unverändert. Eine Summe über 100 % sperrt die Hauptaktion mit konkretem Grund; Auto kann ohne neue Analyse wiederhergestellt werden. |
| L 2×2, RGB 3×3 | Native XISF-Probe: L `0,60`, RGB zusammen `0,40`, Summe 1; Pixelabweichung `3,63e-10`. Ausgabe im Dialog ohne manuelle Gewichtseingabe bereit. |
| Datei, Ansicht, SPFC, Fallback und Abbruch | Native Dialog-/Engine-Proben: Datei- und Ansichtsquellen, SPFC-Vorauswahl, ausdrücklicher LinearFit-Fallback und Referenz-Override laufen. Vor der Ausgabe sind Noise und Fit aufgeschoben; Abbruch nach temporärer XISF hinterlässt weder Ergebnis noch Teildatei und keine Arbeitsfenster. Originalansichten bleiben unverändert. |
| UI | Nativer Dialog für Analyse, Auto, Manuell und gemischtes 3×3-Sampling gerendert. Die Reihenfolge Bilder → Analysieren → Normalisierung → Gewichtung → Ausgabe, beschriftete Ansichten-Aktualisierung, konkrete Sperrgründe und Ergebniszeile wurden geprüft. Tastatur-Tabbing bleibt bei PixInsights nativen Controls; der Nutzer hat die frühere Tab-Navigation bestätigt, die neue Gewichtungszeile wird bei Verwendung des fertigen Skripts geprüft. |

Die Rechenfunktion besteht Node-Tests für 50/80-%-L-Grenzen, manuelle 0/100-%-Grenzen, L plus einen Farbkanal, RGB ohne L, gemischtes Sampling und ungültige Gewichte. Die aktuellen nativen Berichte liegen unter `/tmp/pjsr-*-probe.txt` und sind flüchtig.

## Vereinfachter Dialog ohne Bestätigungs-Checkboxen

Auf Nutzerwunsch entfallen der Text unter dem L-Slider, die zusätzliche Auto-Statuszeile und beide Bestätigungs-Checkboxen. Der native Dialog wurde mit RGB ohne L und L 2×2/RGB 3×3 erneut gerendert. Die PixInsight-Proben zeigen, dass SPFC und ein ausdrücklich gewählter LinearFit-Fallback ohne Checkboxen ausgabebereit sind; RGB-Manuell mit fehlendem oder überhöhtem Gewicht bleibt gesperrt. Datei- und Ansichtsausgabe, Pixelwerte, Originalschutz und Abbruch-Cleanup sind unverändert.

Bei fehlender oder nicht eindeutig gleicher WCS bleibt die Ausgabe möglich und das Protokoll weist auf die nicht sicher prüfbare Registrierung hin. Verschiedene Bildabmessungen und deutliche WCS-Versätze werden weiterhin abgewiesen. Die Eingaben müssen vor dem Skriptlauf korrekt registriert sein; das Skript registriert oder resampelt sie nicht.
