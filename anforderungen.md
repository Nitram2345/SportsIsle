# Sports Battle Isle – Anforderungen

Lebendes Dokument: beschreibt den **aktuellen** Stand des Spiels. Bei jeder Änderung an Regeln, Einheiten, Gelände, Maps oder Bedienung wird es im selben Commit mitgepflegt.

- Ursprüngliches Design (MVP): `docs/superpowers/specs/2026-10-28-sports-battle-isle-mvp-design.md`
- Spielwerte: Quelle der Wahrheit ist `src/config.js`. Die Tabellen hier sind ein Abbild davon.

Stand: 2026-11-01

---

## 1. Kernkonzept

Rundenbasiertes Strategiespiel auf Hex-Karte im Geiste von **Battle Isle 2**, mit Sportlern statt Panzern. Sportstätten stellen Sportler her, Sportler kämpfen, erkunden und erobern.

- **Plattform:** PWA (Browser, iOS, Android), installierbar, offline spielbar.
- **Technik:** HTML5 Canvas, Vanilla JavaScript (ES-Module), kein Framework, kein Build-Schritt.
- **Multiplayer:** Hot-Seat für 2–16 Spieler an einem Gerät. Später: Server, der Aktionen weiterreicht.
- **Hosting:** statisch aus dem Git-Repo (z. B. GitHub Pages).

## 2. Partie

1. Map und Spielerzahl wählen (2 bis Anzahl Startpunkte, max. 16). Name und Farbe je Spieler, keine doppelten Farben.
2. Startpunkte werden möglichst weit auseinander vorgeschlagen, neu würfeln möglich. Einheiten unbenutzter Startpunkte entfallen, ihre Sportstätten werden neutral.
3. Spieler ziehen reihum. Vor jedem Zug verdeckt ein **Übergabe-Bildschirm** die Karte vollständig („Gerät an … geben“). Ausscheiden wird dort angezeigt.
4. **Verloren** hat, wer weder Einheiten noch Sportstätten besitzt. **Gewonnen** hat der letzte Übrige.
5. Der Spielstand wird nach jeder Aktion im Browser gespeichert (ein Spielstand).

## 3. Karte

### 3.1 Raster und Schichten
Pointy-Top-Hex, odd-r-Koordinaten. Jedes Feld hat: **Gelände** (genau eins), **Straße** ja/nein, **Bebauung** (keine / Gebäude / Park / Sportstätte), optional **Startpunkt** und **Sonderfeld**.

### 3.2 Gelände

| Gelände | Zeichen | Bewegung | Verteidigung | Höhe | Wegebau (Runden) | Hinweis |
|---|---|---|---|---|---|---|
| Grasland | G | 1 | 0 | 0 | 2 | |
| Steppe | T | 1 | 0 | 0 | 2 | |
| Strand | S | 1 | 0 | 0 | 2 | |
| Dünen | D | 2 | 0 | 1 | 4 | bodennah (blockt Hockey) |
| hügeliges Grasland | g | 2 | +1 | 1 | 4 | Hügel |
| Hügel | H | 2 | +1 | 1 | 4 | Hügel |
| Wald | F | 2 | +1 | 0 | 3 | Wald |
| hügeliger Wald | h | 3 | +2 | 1 | 4 | Hügel + Wald |
| Moor | B | 3 | 0 | 0 | 2 | nicht bebaubar |
| Berg | M | 3 | +2 | 2 | 7 | nicht bebaubar |
| Fluss | R | 3 | 0 | 0 | – | Straße darauf = Brücke |
| See | L | – | – | 0 | – | nur Schwimmer |
| Meer | W | – | – | 0 | – | nur Schwimmer |
| Seichtes Wasser | U | s. u. | 0 | 0 | – | Ring um jedes Land |

- **Straße:** kostet 1 Bewegungspunkt auf jedem passierbaren Gelände.
- **Seichtes Wasser:** umgibt jedes Land mit genau 1 Feld (Meer/See neben Land wird automatisch seicht, auch im Editor). Alle Einheiten können **hineinwaten**, dort endet die Bewegung. **Heraus** geht es genau 1 Feld weit (egal welche Kosten), danach ist die Bewegung zu Ende – auch für den Jogger. Schwimmer werden nicht gebremst.
- Gebäude, Parks und Sportstätten nur auf bebaubarem Gelände (nicht auf Wasser, Berg, Moor, Fluss).

### 3.3 Sonderfelder
Betreten (auch Durchlaufen) gibt einen Bonus für **3 eigene Züge**; der Zug der Aufnahme zählt nicht mit. Gleiches Feld erneut: Dauer beginnt von vorn. Ein Bewegungsbonus gilt erst ab dem nächsten Zug.

| Sonderfeld | Bonus |
|---|---|
| ⚡ Sprint | Bewegung +2 |
| 💪 Kraftraum | Angriff +2 |
| 🛡️ Schutzschild | Verteidigung +1 |

### 3.4 Nebel der Sicht (zweistufig)
1. **Nie erkundet:** gleiche Farbe wie der Bereich außerhalb der Karte – der Spieler erkennt nicht einmal die Kartengröße.
2. **Erkundet, aber gerade außer Sicht:** Gelände, Bebauung und Sonderfelder bleiben sichtbar (abgedunkelt), Sportstätten zeigen den **zuletzt gesehenen** Besitzer, fremde Einheiten sind unsichtbar.

Sicht kommt von eigenen Einheiten und eigenen Sportstätten; Gelände blockiert Sicht nicht.

## 4. Bewegung

- Bewegungspunkte gegen Geländekosten. **Nur über bereits erkundete Felder.**
- Felder mit Einheiten sind kein Ziel; durch **eigene** Einheiten darf man hindurch.
- Eine Einheit **zieht oder greift an** pro Zug. Nach einem Zug verfallen restliche Punkte (Ausnahme Jogger, s. u.).
- **Entdecken unterwegs:** wird eine fremde Einheit sichtbar, bleibt die eigene sofort stehen und behält ihre Restpunkte; der Spieler entscheidet neu (gilt für alle Einheiten).
- **Kontrollzone (🧱 Hockey, Fußball):** wer ein Nachbarfeld eines sichtbaren gegnerischen Hockeyspielers/Fußballers betritt, muss dort stehen bleiben; hindurch geht nicht. Wer seinen Zug schon in einer Zone beginnt, darf frei wegziehen.
- **Bedienung:** erster Tipp auf das Ziel zeigt den Weg, zweiter Tipp bewegt.

## 5. Kampf

- **Schaden:** `max(1, Angriff − (Verteidigung + Geländebonus des Ziels))`.
- **Schlagbahn:** gezählt werden nur Felder **zwischen** Angreifer und Ziel; liegt die Linie auf einer Kante, blockiert sie nur, wenn beide Felder blockieren. Einheiten blockieren nie.
- **Straßenbonus:** steht das Ziel auf einer Straße, reicht der Schlag 1 Feld weiter (bei Einheiten mit Straßenbonus).
- Ziele müssen für den eigenen Spieler sichtbar sein (eine andere eigene Einheit darf das Ziel „sehen“).

## 6. Einheiten

Alle Einheiten gibt es in männlicher, weiblicher und diverser Darstellung mit zufälligem **Skin** (Variante, Hautton, Frisur), der für die Lebensdauer der Einheit gleich bleibt und keinen Einfluss auf das Spiel hat. Die Spielerfarbe zeigt sich an der Kleidung.

| Einheit | Herstellung | HP | Angr. | Vert. | Bew. | Sicht | Bauzeit | Reichw. | Blockiert durch | Besonderheit |
|---|---|---|---|---|---|---|---|---|---|---|
| Golfer | Golfplatz | 8 | 4 | 1 | 3 | 3 | 3 | 3 | Berg | schlägt über Hügel |
| Tennisspieler | Tennisanlage | 10 | 5 | 2 | 3 | 2 | 2 | 2 | Berg, Hügel, Gebäude | |
| Hockeyspieler | Hockeyplatz | 10 | 7 | 2 | 3 | 2 | 3 | 2 (im Wald 1) | Wald, Hügel, Dünen, Berg, Gebäude | 🧱 Kontrollzone |
| Jogger | Park | 6 | 1 | 1 | 6 | 4 | 2 | 1 | – | 🔁 mehrmals ziehen; Tritt nur vor dem ersten Schritt; 🛤️ Wege anlegen |
| Fußballer | Fußballplatz | 10 | 5 | 2 | 4 | 2 | 2 | 2 | Berg, Hügel, Gebäude | 🧱 Kontrollzone; 🤕 angeschlagen nach Treffer |
| Karateka | Dojo | 12 | 5 | 4 | 2 | 2 | 3 | 1 | – | 🥋 Gegenschlag |
| Rugbyspieler | Rugbyplatz | 12 | 4 | 4 | 3 | 2 | 3 | – | – | 🏉 Rammen; ignoriert Kontrollzonen |
| Bergsteiger | Outdoor-Geschäft | 8 | 4 | 2 | 4 | 3 | 2 | 2 | Berg | 🧗 Klettern |
| Schwimmer | Schwimmbad | 8 | 3 | 1 | 4 | 3 | 2 | 1 | – | 🏊 Wasser |
| Tischtennisspieler | Tischtennishalle | 8 | 3 | 2 | 3 | 2 | 2 | 1 | – | 🏓 2 Angriffe pro Zug |
| Physiotherapeut | Physiopraxis | 6 | – | 1 | 4 | 3 | 2 | – | – | ➕ Behandeln |

### Fähigkeiten im Detail
- **🔁 Jogger – mehrmals ziehen:** Restbewegungspunkte dürfen für weitere Züge genutzt werden. In einer Kontrollzone behält er die Punkte, darf aber nur genau zurück, woher er kam. Der **Tritt** (Angriff 1, Nachbarfeld) geht nur, bevor er sich bewegt hat.
- **🛤️ Jogger – Wege anlegen:** baut auf seinem eigenen Feld eine Straße. Dauer siehe Gelände-Tabelle (Berg 7, Hügel/hügeliger Wald/Dünen 4, Wald 3, sonst 2 Runden). Währenddessen weder ziehen noch angreifen. „Bau abbrechen“ verwirft den Fortschritt. Nicht auf Wasser, vorhandenen Straßen oder Gebäuden. Die fertige Straße gilt für alle Spieler.
- **🧱 Kontrollzone:** siehe Bewegung.
- **🤕 Fußballer – angeschlagen:** nach erlittenem Schaden im nächsten eigenen Zug kein Angriff und halbe Bewegung (abgerundet). Mehrere Treffer verlängern das nicht.
- **🥋 Karateka – Gegenschlag:** wird er von einem **direkt angrenzenden** Angreifer angegriffen und überlebt, schlägt er sofort einmal zurück (kostenlos, kann den Angreifer ausschalten). Fernangriffe erwidert er nicht.
- **🏉 Rugbyspieler – Rammen:** braucht mindestens 2 Felder Anlauf (aus dem Stand oder vom Nachbarfeld nicht möglich). Ziel bekommt normalen Schaden und wird 1 Feld in Laufrichtung weggedrückt; der Rugbyspieler nimmt seinen Platz ein. Kann das Ziel nicht ausweichen (Wasser, Einheit, Kartenrand), bleibt er davor stehen. Nur der Anlauf kostet Bewegungspunkte. Kein Entdeckungsstopp während des Anlaufs. Bedienung: rot markiertes Ziel antippen zeigt den Anlauf, zweiter Tipp rammt.
- **🧗 Bergsteiger – Klettern:** Hügel, hügeliger Wald, hügeliges Grasland und Berg kosten ihn 1 Punkt (Dünen normal). Auf einem Berg: Sicht +2 und nichts blockiert seinen Wurf. **Bergab** (Höhe Berg 2 > Hügel/Dünen 1 > Rest 0): Angriff +1 und Reichweite +1.
- **🏊 Schwimmer:** einzige Einheit auf Fluss, See und Meer (1 Punkt); jedes Landfeld 2, Straße 1.
- **🏓 Tischtennisspieler:** 2 Angriffe pro Zug (auch auf dasselbe Ziel); nach dem ersten Angriff kein Ziehen mehr.
- **➕ Physiotherapeut – Behandeln:** statt anzugreifen heilt er **eine** eigene Einheit auf einem Nachbarfeld um 3 HP (bis zum Maximum) und hebt „angeschlagen“ auf. Nicht nach dem Ziehen. Patienten sind grün markiert.

## 7. Sportstätten und Produktion

| Sportstätte | stellt her | Sicht |
|---|---|---|
| Park | Jogger | 1 |
| Golfplatz | Golfer | 2 |
| Tennisanlage | Tennisspieler | 1 |
| Hockeyplatz | Hockeyspieler | 1 |
| Tischtennishalle | Tischtennisspieler | 1 |
| Fußballplatz | Fußballer | 1 |
| Dojo | Karateka | 1 |
| Rugbyplatz | Rugbyspieler | 1 |
| Outdoor-Geschäft | Bergsteiger | 1 |
| Schwimmbad | Schwimmer | 1 |
| Physiopraxis | Physiotherapeut | 1 |
| Gebäude | – (nicht eroberbar, blockiert Schläge) | – |

- **Erobern:** automatisch, wenn eine Einheit ihre Bewegung auf einer fremden Sportstätte beendet (auch beim Zugende, wenn sie dort schon stand). Laufende Produktion wird abgebrochen.
- **Herstellen:** Einheitentyp wählen; eine Produktion gleichzeitig, wiederholt sich automatisch. Fertige Einheit erscheint auf der Sportstätte oder einem freien Nachbarfeld (Schwimmer auch auf Wasser); ist alles belegt, wartet sie.
- **Grenze:** max. 50 Einheiten pro Spieler. Ab 30 Einheiten +1 Runde Bauzeit, ab 35 +2, ab 40 +3, ab 45 +4.
- Eigene Sportstätten geben Sicht im angegebenen Umkreis.

## 8. Maps

- Maps sind JSON-Dateien (`maps/<id>.json`, `"format": 1`), Liste in `maps/index.json`.
- **Mitgeliefert:** Insel-Duell (2), Vierland (4), Archipel (16), Die Erde (16), Philippinen (6), Mordor (4), Mars mit Ozean (6), Hawaii (5), Alpen (4).
- Jede mitgelieferte Map enthält alle Sportstätten-Typen; Schwimmbäder stehen an der Küste.

### Map-Editor
Neue Map (6–40 × 6–40), Pinsel je Schicht (Gelände, Straße, Bebauung, Sonderfeld, Startpunkt), Startaufstellung je Startpunkt, Sportstätten einem Start zuordnen. Seichtes Wasser wird automatisch gezogen. Export als Datei, Import über Dateiauswahl (fehlerhafte Dateien werden mit Meldung abgelehnt), Testspiel. Eigene Maps werden lokal gespeichert, neue/importierte Maps bekommen eine eindeutige ID.

## 9. Bedienung (Spiel)

- Tippen wählt aus, Wischen verschiebt, zwei Finger zoomen (Maus: Ziehen, Mausrad).
- **Markierungen:** erreichbare Felder blau, Angriffsziele rot gestrichelt, Heilziele grün gestrichelt, gewählter Weg als gestrichelte Linie (Rammen rot).
- **„Nächste Einheit (n)“** oben springt zur nächsten Einheit, die noch nichts getan hat. Sind alle bewegt: „✓ Alle Einheiten bewegt“.
- **Info-Feld** unten: Werte, Fähigkeiten, Zustände (Buffs, angeschlagen, Wegebau), Produktion bei Sportstätten, Aktionsknöpfe (Weg anlegen / abbrechen).
- Kurze Meldungen bei Ereignissen (Treffer, Gegenschlag, erobert, entdeckt, Weg fertig …).
- Menü: Weiterspielen, Hauptmenü (Spiel bleibt gespeichert), Spiel aufgeben.

## 10. Darstellung

- Bedienoberfläche flach und freundlich (große Knöpfe), Gelände im Stil von Battle Isle 2.
- Figuren und Sportstätten sind SVG-Dateien (`units/`, `facilities/`) mit Platzhalterfarben für Spielerfarbe (`#FF00FF`) und Hautton (`#00FFFF`). Figuren ragen über den Feldrand, Sportstätten haben innen einen Rand in Besitzerfarbe.
- Lebensbalken und Zustandssymbole an den Figuren.

### 10.1 Animationen
Kurz und schnell, Eingaben sind während einer Animation gesperrt. Die Spiellogik bleibt unverändert: die Animation spielt nur das Ergebnis einer Aktion ab (gleiche Ereignisse funktionieren später auch online). Mit der Systemeinstellung „Bewegung reduzieren“ entfallen sie.
- **Bewegung:** Die Figur gleitet Feld für Feld den gelaufenen Weg entlang (110 ms pro Feld) und wippt dabei leicht. Nach einem Entdeckungsstopp nur bis zum Haltefeld.
- **Fernangriff:** Ball/Stein fliegt auf einem Bogen zum Ziel (Golf hoch, Tennis/Fußball flacher, Hockey flach, Bergsteiger-Stein).
- **Nahangriff:** kurzer Ausfallschritt zum Ziel und zurück.
- **Treffer:** Ziel blinkt rot und wackelt, Schadenszahl („−3“) steigt auf. Gegenschlag folgt sichtbar danach.
- **Rammen:** Anlauf, dann schiebt der Rugbyspieler das Ziel ein Feld weiter (oder prallt ab, wenn es nicht ausweichen kann).
- **Behandeln:** kurzer Schritt zum Patienten, grünes „+3“ steigt auf.
- Markierungen (Reichweite, Ziele, Weg) sind während der Animation ausgeblendet.

## 11. Offen / geplant

- Sportstätten bauen, Wirtschaft.
- Online-Multiplayer über Server (Aktionen sind bereits als `apply(state, action)` gekapselt).
- Weitere Einheiten (Ideen: Trainer, Radfahrer, Schiedsrichter).
- Startpunkte beim neuen Spiel von Hand wählen; eigene Maps löschen.
