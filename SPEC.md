# Projekt-Spec (Entwurf): PixInsight SLUM

**Status:** Fachlich freigegeben am 6. November 2026

**Fachliche Grundlage:** [PixInsight Super-Luminanz – Workflow und Berechnungen](docs/pixinsight_super_lum_workflow.md)

## Capability Map

Der MVP liefert eine zusammenhängende Fähigkeit. Die folgenden Teile sind innerhalb dieser Fähigkeit separat prüfbar:

| Teil | Verantwortung | Voraussetzung |
| --- | --- | --- |
| Eingabeprüfung | 2–4 lineare, registrierte Monochrom-Master aus L, R, G, B auswählen und auf Verwendbarkeit prüfen | — |
| Referenz und Fit | Referenz statistisch bestimmen, Übersteuerung erlauben und alle übrigen Kanäle per LinearFit anpassen | Eingabeprüfung |
| Gewichtung und Ausgabe | NoiseEvaluation der tatsächlich kombinierten Bilder, Gewichtung für gleiches oder gemischtes Binning, SLUM-Ausgabe und Protokoll | Referenz und Fit |

Reihenfolge: Eingabeprüfung → Referenz und Fit → Gewichtung und Ausgabe. Diese Teile sind keine separat auszuliefernden Produkte.

## Zielgruppe und Problem

Zielgruppe sind Astrofotografierende, die lineare LRGB-Master in PixInsight bearbeiten und eine Super-Luminanz für den weiteren Luminanz-Workflow erzeugen möchten. Der bisherige Ablauf erfordert manuelle Auswahl einer LinearFit-Referenz, wiederholte NoiseEvaluation, Gewichtsrechnung und eine fehleranfällige PixelMath-Formel. Die Anwendung soll diese Schritte nachvollziehbar und reproduzierbar ausführen.

## Ziel

Ein PixInsight-Skript erzeugt aus mindestens zwei ausgewählten Kanälen **ausschließlich eine neue SLUM-Datei** als lineares Graustufen-XISF. Es schlägt die LinearFit-Referenz anhand einer berechneten Bildstatistik aus den **tatsächlich gewählten** Kanälen vor; der Nutzer kann einen anderen gewählten Kanal als Referenz festlegen. Das Ergebnis basiert auf den Rauschwerten der angepassten Bilder und kann unmittelbar im üblichen PixInsight-Luminanz-Workflow weiterverarbeitet werden. Die Originaldateien und ihre geöffneten Bildansichten bleiben unverändert.

Erfolg bedeutet: Der Nutzer kann sowohl LRGB als auch eine Teilmenge wie RGB ohne manuelle Gewichtsrechnung verarbeiten. Auch Master mit unterschiedlichem ursprünglichem Binning lassen sich kombinieren, wenn sie auf demselben registrierten Ausgaberaster liegen und der Nutzer die Anteile zwischen Sampling-Gruppen festlegt. Das Protokoll erklärt Referenzwahl und Gewichte.

## MVP

1. **Dateiauswahl:** Je ein optionaler Dateipfad für L, R, G und B; mindestens zwei Kanäle müssen belegt sein. Eine Datei darf nicht mehrfach zugeordnet werden. Die Eingaben sind lineare, monochrome, bereits registrierte und gleich beschnittene Master.
2. **Prüfung:** Alle Eingaben müssen dasselbe registrierte Ausgaberaster, denselben Bildausschnitt und dieselben Bildabmessungen haben; das Skript registriert oder resampelt sie nicht selbst. Es prüft die Geometrie anhand verfügbarer Metadaten und verlangt eine Nutzerbestätigung, wenn die Registrierung daraus nicht eindeutig hervorgeht. Das **ursprüngliche Binning beziehungsweise die effektive native Pixel-Skala** jedes Masters wird aus Metadaten gelesen und angezeigt. Fehlt oder widerspricht diese Information der tatsächlichen Aufnahme, kann der Nutzer sie korrigieren; vor der Kombination muss sie für jeden Kanal feststehen. Unterschiedliche native Sampling-Werte sind zulässig und bilden getrennte Gruppen. Offensichtlich ungültige Dateien oder ungeeignete Bildtypen werden abgewiesen. Die Linearität und erfolgte Gradientenkorrektur werden als Vorbedingungen deutlich angezeigt; eine zuverlässige automatische Erkennung ist nicht Teil des MVP.
3. **LinearFit-Referenz:** Für jedes ausgewählte Bild wird der Median der gültigen Pixel im gemeinsamen Bildbereich bestimmt. Schwarze Registrierungsränder und gesättigte Pixel werden ausgeschlossen. Das Bild mit dem **niedrigsten Median** ist die automatische Empfehlung; bei Gleichstand gilt die feste Reihenfolge L, R, G, B. Der Nutzer kann stattdessen jeden anderen ausgewählten Kanal als Referenz wählen. Empfehlung, tatsächliche Wahl und alle Medianwerte werden angezeigt und protokolliert. Der gewählte Referenzkanal wird nicht gefittet, alle übrigen werden auf ihn gefittet. Die Medianregel ist eine vereinbarte fachliche Heuristik, keine behauptete PixInsight-Vorgabe.
4. **Rauschmessung:** NoiseEvaluation läuft nach LinearFit auf genau den Bildversionen, die anschließend kombiniert werden. Ungültige oder nichtpositive Noise-Werte stoppen den Lauf. `count(%)` dient nur als Qualitätsindikator: unter 50 % Warnung, unter 25 % deutliche Warnung; es verändert das Gewicht nicht.
5. **Gleiches Sampling:** Für jeden Kanal gilt `wᵢ = 1 / noiseᵢ²`; die Gewichte werden auf Summe 1 normiert. SLUM ist die gewichtete Summe der gefitteten Bilder.
6. **Gemischtes Binning:** Kanäle mit gleichem ursprünglichem Sampling bilden je eine Gruppe. **Nur innerhalb** einer Gruppe werden `1/noise²`-Gewichte verglichen und auf 1 normiert. Bei nur einer Gruppe beträgt deren Anteil automatisch 100 %. Bei mehreren Gruppen legt der Nutzer für jede Gruppe ausdrücklich einen Anteil an der Gesamtmischung fest; diese Anteile müssen zusammen 100 % ergeben. Das endgültige Gewicht eines Kanals ist `Gruppenanteil × normiertes Gewicht innerhalb der Gruppe`. Für eine Gruppe mit nur einem Kanal ist das interne Gewicht 1. Das Skript wählt keinen universellen Anteil zwischen unterschiedlichen Sampling-Gruppen. Beim Beispiel L 1×1 und RGB 2×2 kann der Nutzer etwa 70 % L und 30 % RGB wählen; dieser Wert ist keine feste Voreinstellung oder allgemeine Regel.
7. **Ausgabe und Nachvollziehbarkeit:** Belichtungszeit, Anzahl Subs und SNR fließen nicht zusätzlich in die Gewichte ein. Die einzige dauerhaft erzeugte Datei ist eine lineare Graustufen-XISF mit 32-Bit-Fließkommawerten; PixelMath-Rescaling ist deaktiviert. Vor dem Speichern sind gewählte Dateien, empfohlene und tatsächliche Referenz samt Median, natives Sampling, Noise, `count(%)`, gegebenenfalls Gruppenanteile, endgültige Gewichte und Warnungen in der Bedienoberfläche sichtbar. Ein Protokoll in der Bedienoberfläche enthält diese Werte und den Ausgabepfad; es wird keine zusätzliche Protokolldatei erstellt. LinearFit-Zwischenbilder und andere Hilfsdaten bleiben temporär und werden nach Erfolg, Abbruch oder Fehler entfernt. Originaldateien und ursprüngliche Bildansichten werden nie verändert oder gespeichert.

## Nutzungsabläufe

**LRGB:** Nutzer wählt L, R, G und B, bestätigt die vorbereiteten linearen Master und startet den Lauf. Das Skript prüft die Daten, ermittelt die Referenz, fittet die drei anderen Kanäle, misst Noise, berechnet Gewichte und speichert SLUM.

**RGB ohne L:** Nutzer wählt nur R, G und B. Die Referenz wird ausschließlich aus R, G und B bestimmt; die übrigen zwei Kanäle werden gefittet. Danach folgt dieselbe Noise-Gewichtung und Ausgabe.

**Weitere Teilmenge:** Jede Kombination aus zwei oder drei unterschiedlichen Kanälen ist zulässig. Ein einzelnes Bild führt zu einer verständlichen Fehlermeldung, weil damit keine Kombination entsteht.

**Referenz übersteuern:** Nach der automatischen Empfehlung wählt der Nutzer einen anderen der ausgewählten Kanäle. Das Skript verwendet diesen als LinearFit-Referenz und hält Empfehlung und Übersteuerung im Protokoll fest.

**Gemischtes Binning:** Nutzer wählt bereits auf ein gemeinsames Ausgaberaster registrierte L- und RGB-Master mit unterschiedlichen ursprünglichen Binning-Werten. Das Skript zeigt die Sampling-Gruppen; der Nutzer trägt deren Anteile ein. RGB wird innerhalb seiner Gruppe nach Noise gewichtet, L erhält den festgelegten Gruppenanteil, und die fertige Summe wird als SLUM gespeichert. Entsprechend funktionieren andere Gruppenaufteilungen mit zwei bis vier Kanälen.

**Unpassende Daten:** Bei abweichenden Bildmaßen oder Ausgaberaster, fehlender Sampling-Angabe, die nicht ergänzt wurde, oder Gruppenanteilen ungleich 100 % erfolgt keine Ausgabe. Bei unsicherer Noise-Schätzung zeigt das Skript die Warnung vor der Ausgabe an.

## Akzeptanzkriterien

1. Ein LRGB-Satz und ein RGB-Satz lassen sich jeweils ohne festen L-Referenzkanal verarbeiten; das Protokoll zeigt die automatische Empfehlung und die tatsächliche Referenz. Eine manuelle Übersteuerung wird für LinearFit verwendet.
2. Bei gleichem Sampling und gültigen Noise-Werten entsprechen die normierten Gewichte bis auf Rundungsfehler `1/noise²` geteilt durch die Summe aller inversen Varianzen; ihre Summe ist 1.
3. NoiseEvaluation bezieht sich auf die endgültigen Fit-Ergebnisse und das unveränderte Referenzbild, also genau auf die anschließend kombinierten Bildversionen.
4. Bei gemischtem ursprünglichem Sampling werden Noise-Werte ausschließlich innerhalb derselben Gruppe direkt verglichen. Die endgültigen Kanalgewichte entsprechen `Gruppenanteil × internes normiertes inverses Varianzgewicht` und summieren sich zu 1. Der L-1×1/RGB-2×2-Fall funktioniert mit vom Nutzer festgelegten Gruppenanteilen.
5. Bei erfolgreichem Lauf existiert genau eine neue Datei: ein öffnendes, lineares Graustufen-XISF in 32-Bit-Float, ohne nachträgliches Rescaling. Die Originaldateien und ihre geöffneten Ansichten sind nach dem Lauf unverändert; dies wird für Testdaten durch Dateivergleich und Ansichtskontrolle geprüft. Es bleiben keine gespeicherten Zwischenbilder oder Protokolldateien zurück.
6. Unterschiedliche Bildmaße oder Ausgaberaster, doppelt zugeordnete Dateien, ein einzelner Kanal, unbekannt gebliebenes natives Sampling, ungültige Gruppenanteile und ungültige Noise-Werte führen zu einer konkreten Fehlermeldung ohne SLUM-Datei. Auch bei Abbruch oder Fehler bleiben Originale unverändert und temporäre Daten werden entfernt.
7. `count(%)` unter 50 % beziehungsweise unter 25 % erzeugt die passende Warnstufe, ändert aber kein Gewicht.
8. Der Nutzer kann aus dem Protokoll Eingaben, Referenzentscheidung, Sampling-Gruppen, Gruppenanteile, Noise-Werte, Gewichte und Ausgabepfad rekonstruieren.

## Nicht-Ziele des MVP

- Registrierung, Crop, Gradientenentfernung, SPFC/MGC, Farbkalibrierung und RGB-Erzeugung.
- Deconvolution, Denoising, Stretch oder andere Bearbeitung nach SLUM.
- Automatische Registrierung oder Resampling sowie automatisch aus Noise abgeleitete Anteile **zwischen** unterschiedlichen Sampling-Gruppen; insbesondere keine feste 70/30-Mischung.
- SNR-basierte Ersatzgewichtung, manuelle Gewichtsedition oder Stapelverarbeitung mehrerer Datensätze.
- Ein nativer PixInsight-Prozess in C++; das MVP wird als PixInsight-Skript spezifiziert.

## Rahmenbedingungen und Qualität

- PixInsight ist Laufzeit und Bedienoberfläche; die konkrete unterstützte Version sowie Skript-API werden vor der technischen Planung geprüft und festgelegt.
- Eingaben werden nur gelesen. LinearFit und weitere Verarbeitungsschritte laufen auf temporären Kopien; weder Originaldateien noch bereits geöffnete Originalansichten werden verändert. Ausgabeort und Dateiname werden vor dem Lauf gewählt; ein bestehendes Ziel wird nicht stillschweigend überschrieben. Nur die fertige SLUM-Datei wird dauerhaft geschrieben.
- Der Workflow setzt vorab lineare, auf dasselbe Ausgaberaster registrierte, gleich beschnittene und gradientenkorrigierte Master voraus. Unterschiedliches ursprüngliches Binning ist zulässig, wenn diese gemeinsame Geometrie bereits hergestellt ist.
- Unterschiedliche native Pixelmaßstäbe dürfen nicht mit einer einzigen inversen Noise-Gewichtung über alle Kanäle kombiniert werden. Im MVP regeln bestätigte Gruppenanteile die Mischung zwischen den Sampling-Gruppen.
- Die Berechnung muss mit Beispieldaten und einem kleinen PixInsight-Datensatz reproduzierbar geprüft werden. Test- und Startbefehle, Projektstruktur und Codestil werden erst mit dem technischen Plan festgelegt; es gibt noch keine Codebasis und keine belastbaren Befehle.

## Fachliche Entscheidungen

- **Bestätigt:** Die automatische LinearFit-Referenz nutzt den niedrigsten Median gültiger Pixel. Eine manuelle Übersteuerung ist Teil des MVP.
- **Bestätigt:** Gemischtes Binning wird im MVP unterstützt.
- **Bestätigt:** Die Originaldateien bleiben unverändert; dauerhaft entsteht ausschließlich die fertige SLUM-Datei.
- **Mit der Spec freigegeben:** Master mit unterschiedlichem ursprünglichem Binning sind vor dem Skriptlauf bereits auf dasselbe Bildraster registriert. Für die Mischung zwischen Sampling-Gruppen bestätigt der Nutzer explizit deren Anteile. Die Gewichtung innerhalb jeder Gruppe erfolgt weiterhin automatisch aus NoiseEvaluation. Dies vermeidet, unterschiedliche Noise-Werte direkt als vergleichbar zu behandeln und behauptet keine allgemeingültige 70/30-Regel.

Die technische Planung folgt als eigener Freigabeschritt. Code und Auslieferung sind von dieser Freigabe nicht umfasst.
