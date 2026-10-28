# Sports Battle Isle – MVP Design

Stand: 2026-10-28 · Status: Entwurf zur Freigabe

## 1. Worum es geht

Rundenbasiertes Strategiespiel auf Hex-Karte im Geiste von **Battle Isle 2**, mit Sport-Thema: Sportler sind Einheiten, Sportstätten produzieren sie. Läuft als **PWA** auf dem Handy, installierbar und offline spielbar.

Ein großer Teil der Magie liegt in **guten Maps** und einem **einfachen Map-Editor**. Maps sind einfache Dateien, die man über das Web austauschen kann.

**Ausgangslage:** Wir fangen bei null an. Es gibt keinen Code. Die Häkchen im alten `anforderungen.md` und in `CLAUDE.md` stimmen nicht und werden korrigiert.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele (MVP)**
- Hot-Seat für **2 bis 16 Spieler** an einem Gerät.
- **Hex-Raster von Anfang an.**
- Nebel der Sicht, Sportstätten erobern, Einheiten herstellen, letzter Überlebender gewinnt.
- Map-Editor, Export und Import der Maps als Datei.
- PWA mit Manifest und Service Worker, offline spielbar, Spielstand übersteht das Schließen der App.
- Alle Spielwerte in Configs, keine festen Werte in der Logik.

**Nicht-Ziele (später)**
- Server und Online-Multiplayer. Die Architektur bereitet ihn vor (siehe 9.2), gebaut wird er nicht.
- Sportstätten bauen, Wirtschaft und Währung.
- Weitere Einheiten wie der Physiotherapeut mit HEAL, sowie REPAIR.
- Teams und Bündnisse, KI-Gegner, Sound.
- Map-Galerie oder Upload im Web. Neue offizielle Maps kommen per Pull Request ins Repo.

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch funktioniert)**
- Der nächste Spieler sieht beim Hot-Seat die Karte des vorherigen. Dann wäre der Nebel wertlos.
- Ruckeln auf Mittelklasse-Handys.
- Neue Einheiten, Gelände oder Sonderfelder erfordern Code-Änderungen statt Config-Einträgen.
- Figuren verschwinden im Gelände oder ihre Spielerfarbe ist nicht zu erkennen.

## 3. Technik (Rahmen)

- Reines HTML5, Canvas und JavaScript (ES-Module), ohne Framework und ohne Build-Schritt. Die Dateien werden direkt ausgeliefert.
- Statisches Hosting aus dem Git-Repo, z. B. GitHub Pages. PWA und Maps liegen im selben Repo.
- Die Regel „eine Datei“ aus `CLAUDE.md` wird aufgehoben. Wegen Editor, Spiel, Configs und SVGs nutzen wir mehrere ES-Module. Die Trennung von Logik und Darstellung bleibt Pflicht.
- Touch und Maus: Tippen wählt aus, Wischen verschiebt die Karte, zwei Finger zoomen (Maus: Ziehen und Mausrad). Der Canvas passt sich beim Ändern der Fenstergröße an.

## 4. Karte

### 4.1 Raster
- Pointy-Top-Hexfelder, Axial-Koordinaten `(q, r)`.
- Map-Größe frei wählbar im Editor. Richtwert für das MVP: bis etwa 40×40 Felder.

### 4.2 Schichten eines Feldes
| Schicht | Werte |
|---|---|
| Gelände (genau eins) | Berg, Hügel, hügeliger Wald, Wald, Fluss, Moor, See, Meer, Strand, Grasland, Steppe, hügeliges Grasland, Dünen |
| Straße | ja / nein. Straße auf Fluss = Brücke |
| Bebauung | keine / Gebäude / Park / Sportstätte (Typ aus Config) |
| Startpunkt | optional, Spieler 1–16 |
| Sonderfeld | optional, Typ aus Config |

### 4.3 Gelände-Config (Startwerte, im Spiel abzustimmen)
Jedes Gelände hat: Bewegungskosten, Verteidigungsbonus, passierbar ja/nein, Flags für die Schlagbahn (`hill`, `forest`, `mountain`, `ground`, siehe 6.3).

| Gelände | Bewegung | Verteidigung | Hinweis |
|---|---|---|---|
| Grasland, Steppe, Strand | 1 | 0 | |
| Dünen | 2 | 0 | flach am Boden (`ground`) |
| hügeliges Grasland | 2 | +1 | Hügel |
| Hügel | 2 | +1 | Hügel |
| Wald | 2 | +1 | Wald |
| hügeliger Wald | 3 | +2 | Hügel + Wald |
| Moor | 3 | 0 | |
| Berg | 3 | +2 | Berg |
| Fluss | 3 | 0 | mit Straße (Brücke) 1 |
| See, Meer | unpassierbar | – | |

Eine Straße senkt die Bewegungskosten auf 1, auf jedem passierbaren Gelände.

**Regel im Editor:** Gebäude, Parks und Sportstätten sind auf Wasser, Berg und Moor nicht erlaubt.

### 4.4 Map-Datei
- JSON, eine Datei pro Map, `maps/<id>.json`, mit Versionsfeld `"format": 1`.
- Inhalt: Name, Autor, Größe, empfohlene Spielerzahl (min/max), alle Felder mit ihren Schichten, und je Startpunkt die **Startaufstellung** (Liste der Einheitenarten, optional Sportstätten, die dieser Spieler zu Beginn besitzt).
- `maps/index.json` listet alle mitgelieferten Maps (id, Name, Spielerzahl, Größe), weil ein statischer Server keine Ordner auflisten kann.
- Das genaue JSON-Schema legt der Builder fest. Es soll von Hand lesbar und in Git gut vergleichbar sein.

## 5. Map-Editor
- Neue Map: Größe wählen, alles startet als Grasland.
- Pro Schicht ein Pinsel: Gelände, Straße an/aus, Bebauung, Startpunkt, Sonderfeld. Radierer pro Schicht.
- Malen durch Tippen und Wischen. Karte verschieben und zoomen wie im Spiel.
- Startaufstellung je Startpunkt festlegen. Skins werden **nicht** festgelegt, die entstehen erst beim Spielstart.
- Ungültige Kombinationen (siehe 4.3) verhindert der Editor.
- **Export** als Datei-Download, **Import** über die Dateiauswahl. Eine importierte Map kann direkt gespielt werden.
- Check vor Export: mindestens 2 Startpunkte, jeder hat mindestens eine Einheit oder Sportstätte.
- Selbst erstellte und importierte Maps bleiben lokal im Browser gespeichert.

## 6. Spielregeln

### 6.1 Partie
1. Map und Spielerzahl wählen (2 bis zur Anzahl Startpunkte, max 16). Spielernamen und Farben aus 16 festen, gut unterscheidbaren Farben.
2. Jeder Spieler startet mit der Aufstellung aus der Map. Alle übrigen Sportstätten sind neutral.
   - **Weniger Spieler als Startpunkte:** Das Spiel schlägt Startpunkte so vor, dass die Spieler möglichst **weit auseinander** liegen (größter Mindestabstand). Im Bildschirm „Neues Spiel“ kann man das ändern oder neu würfeln. Die Einheiten unbenutzter Startpunkte fallen weg, ihre Sportstätten werden neutral.
3. Die Spieler ziehen reihum. Jeder Zug läuft so ab: **Übergabe-Bildschirm** („Gerät an Spieler 4 geben – tippen zum Start“), dann der Zug, dann „Zug beenden“.
4. **Verloren** hat, wer weder Einheiten noch Sportstätten besitzt. Er wird in der Zugreihenfolge übersprungen, das Ausscheiden wird kurz angezeigt.
5. **Gewonnen** hat, wer als Letzter übrig bleibt.

### 6.2 Einheiten im Zug
- Jede Einheit kann im eigenen Zug **entweder** sich bewegen **oder** schlagen. Wer sich bewegt hat, kann nicht mehr schlagen.
- Bewegung: Bewegungspunkte gegen Geländekosten. Felder mit Einheiten sind nicht betretbar (eigene auch nicht, keine Stapel).
  - *Unsere Entscheidung:* Durch **eigene** Einheiten darf man hindurchlaufen, nur nicht auf ihrem Feld stehen bleiben. Durch fremde Einheiten nicht.
- **Entdecken unterwegs:** Die erreichbaren Felder werden so berechnet, als stünden im Nebel keine fremden Einheiten. Die Einheit läuft ihren Weg Feld für Feld. Wird dabei eine fremde Einheit sichtbar, **bleibt die eigene Einheit sofort stehen**. Die restlichen Bewegungspunkte behält sie, und der Spieler entscheidet neu, wohin sie geht. Das gilt auch, wenn die fremde Einheit nicht im Weg steht.
  - Folge für die Aktionen: `move` enthält den Weg, nicht nur das Ziel. Die Logik geht ihn Schritt für Schritt durch und kann ihn abbrechen. Restbewegung bleibt im Zustand der Einheit (`movesLeft`). Eine Einheit mit Restbewegung gilt als bewegt und kann in diesem Zug nicht mehr schlagen.
- **Schaden:** `max(1, Angriff − (Verteidigung + Geländebonus des Ziels))`. Bei 0 HP wird die Einheit entfernt.
- Kein Gegenschlag im MVP.
- Mit Beginn des eigenen Zuges werden `hasMoved` und `hasAttacked` aller eigenen Einheiten zurückgesetzt.

### 6.3 Schlagweite und Schlagbahn
Die Gerade von Feldmitte zu Feldmitte wird geprüft. Es zählen nur die Felder **zwischen** Schlagendem und Ziel, das Zielfeld selbst blockiert nie. Liegt die Linie genau auf einer Kante, blockiert sie nur, wenn **beide** Felder blockieren. Einheiten blockieren nie.

| Einheit | Schlagweite | Blockiert durch | Besonderes |
|---|---|---|---|
| Golfer | 3 | Berg | weit und hoch, wenig Schaden |
| Tennisspieler | 2 | Berg, alle Hügel (Hügel, hügeliger Wald, hügeliges Grasland), Gebäude und Sportstätten | Allrounder |
| Hockeyspieler | 2, **nur 1**, wenn er selbst im (hügeligen) Wald steht | alles Bodennahe: Wald, hügeliger Wald, Hügel, hügeliges Grasland, Dünen, Berg, Gebäude und Sportstätten (Parks nicht) | viel Schaden |
| Jogger | – (schlägt nicht) | – | viele Bewegungspunkte, große Sicht, Entdecker |

**Straßenbonus:** Steht das **Ziel** auf einer Straße, reicht der Schlag 1 Feld weiter.

In der Config steht pro Einheit: `range`, `blockedBy` (Liste von Gelände- und Bebauungs-Flags), Ausnahmen für die Reichweite (Hockey im Wald) und `roadBonus`.

### 6.4 Einheiten-Werte (Startwerte, im Spiel abzustimmen)
| Einheit | HP | Angriff | Verteidigung | Bewegung | Sicht | Bauzeit (Züge) |
|---|---|---|---|---|---|---|
| Golfer | 8 | 4 | 1 | 3 | 3 | 3 |
| Tennisspieler | 10 | 5 | 2 | 3 | 2 | 2 |
| Hockeyspieler | 10 | 7 | 2 | 3 | 2 | 3 |
| Jogger | 6 | 0 | 1 | 6 | 4 | 1 |

### 6.5 Sportstätten
| Sportstätte | stellt her | Sicht |
|---|---|---|
| Golfplatz | Golfer | 2 |
| Tennisanlage | Tennisspieler | 1 |
| Hockeyplatz | Hockeyspieler | 1 |
| Park | Jogger | 1 |
| Tischtennishalle | – (im MVP nur zum Erobern, Einheit folgt später) | 1 |

- Der Park ist eine Bebauung. Er stellt Jogger her und kann wie eine Sportstätte erobert werden.
- **Erobern:** Eine Einheit **beendet** ihren Zug auf einer neutralen oder gegnerischen Sportstätte. Damit gehört die Sportstätte ihrem Spieler, eine laufende Produktion wird abgebrochen.
  - *Unsere Entscheidung:* Erobern geschieht automatisch, sobald die Bewegung einer Einheit auf der Sportstätte endet. Es ist keine eigene Aktion (`capture` entfällt aus 9.2). Sicht und Besitz ändern sich sofort. Steht eine Einheit zu Beginn ihres Zuges auf einer fremden Sportstätte (z. B. dort hergestellt oder nach einem Besitzwechsel), wird beim „Zug beenden“ erobert. Nach dem Erobern kann die Einheit nicht mehr schlagen, weil sie sich bewegt hat.
- **Herstellen:** Der Besitzer wählt eine Einheit, die die Sportstätte herstellen kann. Es läuft immer nur eine Produktion gleichzeitig. Nach X **eigenen** Zügen erscheint die Einheit auf der Sportstätte oder, falls die belegt ist, auf einem freien Nachbarfeld. Ist alles belegt, wartet sie bis zum nächsten Zug.
  - *Unsere Entscheidung:* Die Produktion wiederholt sich automatisch, bis der Besitzer sie ändert oder stoppt.
- **Einheiten-Grenze:** höchstens **50 Einheiten pro Spieler**. Ab 30 Einheiten dauert jede Produktion 1 Zug länger, ab 35 2 Züge, ab 40 3, ab 45 4. Bei 50 pausiert die Produktion. Gezählt wird beim Start jeder Produktion. Die Werte stehen in der Config (`unitCap: 50`, `slowdownFrom: 30`, `slowdownStep: 5`).
- Keine Kosten außer der Zeit.
- Eigene Sportstätten decken den Nebel im Umkreis ihrer Sicht auf. Neutrale und gegnerische geben keine Sicht.

### 6.6 Sonderfelder
- Betritt eine Einheit ein Sonderfeld, bekommt sie einen Bonus: `{ stat, amount, turns }`, z. B. Bewegung +2 für 3 Züge oder Angriff +2 für 3 Züge.
- `turns` zählt die **eigenen Züge** des Besitzers.
- Das Feld bleibt bestehen und kann von jeder Einheit genutzt werden, auch vom Gegner.
- Boni stapeln sich nicht. Betritt eine Einheit dasselbe Feld erneut, beginnt die Dauer von vorn. Unterschiedliche Boni (Bewegung und Angriff) können gleichzeitig aktiv sein.
- Ausgelöst wird beim **Betreten**, also auch beim Durchlaufen.
- *Unsere Entscheidung:* Der Bonus gilt erst **nach** der aktuellen Bewegung. Ein Bewegungsbonus verlängert also nicht den laufenden Zug. Das hält die Berechnung der erreichbaren Felder einfach. Der Zug, in dem der Bonus aufgenommen wurde, zählt nicht zu den `turns`.
- An der Einheit zeigt ein kleines Symbol, dass ein Bonus aktiv ist.

### 6.7 Nebel der Sicht
- Gelände, Bebauung und Sonderfelder bleiben sichtbar, sobald ein Feld einmal entdeckt wurde.
- Fremde Einheiten sieht man nur, solange eine eigene Einheit oder eigene Sportstätte sie in Sicht hat.
- Sportstätten im Nebel zeigen den Besitzer, den man **zuletzt gesehen** hat.
- Sicht wird nicht durch Gelände blockiert. Es zählt nur der Abstand in Hex-Feldern.
- Jeder Spieler hat seine eigene Karte der entdeckten Felder.

## 7. Darstellung

Richtung: Bedienelemente wie Entwurf **A** (flach, freundlich, große Knöpfe), Gelände im Stil von **Battle Isle 2** (gedeckte, natürliche Farben, gezeichnete Details). Referenz ist der Entwurf `docs/design-reference/look-v3.html`.

- **Gelände** zeichnet der Code: Baumkronen, Erdbuckel für Hügel, Berge mit Schneespitzen, Wellenlinien für Dünen und Wasser, Tümpel mit Schilf fürs Moor. Straßen laufen als durchgehender Weg von Feldmitte zu Feldmitte und verbinden sich mit benachbarten Straßenfeldern. Feine Variation pro Feld, aber stabil (gleiches Feld sieht immer gleich aus, z. B. Zufall mit Koordinaten als Startwert).
- **Einheiten** sind größer als das Feld und ragen über den Rand. Kein Kreis darunter, das Gelände bleibt sichtbar. Ein dünner dunkler Umriss und ein Schatten am Boden halten sie lesbar. Darunter sitzt ein kleiner Lebensbalken.
- **Spielerfarbe** zeigt sich an der Kleidung (Oberteil, Mütze usw.). Schatten und Glanz liegen halbtransparent darüber und funktionieren mit jeder Farbe.
- **Sportstätten** ragen leicht über das Feld und haben immer einen Rand **innen** im Hex in der Farbe ihres Besitzers, grau bei neutral.
- Markierungen: gewählte Einheit (gelber Rand), erreichbare Felder, Felder in Schlagweite, mögliche Ziele.
- Nebel: entdeckte, aber gerade nicht sichtbare Felder abgedunkelt. Nie gesehene Felder ganz dunkel.

### 7.1 Skins
- Jede Einheit hat eine Eigenschaft `skin`. Sie wird zufällig vergeben, wenn die Einheit entsteht (Spielstart oder Produktion), und bleibt gleich, solange die Einheit lebt. Sie steht im Spielstand.
- Ein Skin besteht aus: **männlich / weiblich / divers**, Hautton (4 Stufen) und Frisur (mehrere je Variante). Alle Spielwerte sind gleich.
- Divers: androgyne Figur mit neutraler Statur und Frisur (unsere Interpretation, gern anzupassen).
- Skin hat keinen Einfluss auf das Spiel.

### 7.2 Grafikdateien
- **Eine SVG-Datei pro Einheitenart:** `units/golfer.svg`, `units/tennis.svg`, `units/hockey.svg`, `units/jogger.svg`. Varianten (männlich/weiblich/divers) und Frisuren als benannte Gruppen in derselben Datei, damit man sie in Inkscape leicht ändern oder ergänzen kann.
- Sportstätten ebenso: `facilities/<typ>.svg`.
- **Platzhalterfarben** in den SVGs: eine für die Spielerfarbe (z. B. `#FF00FF`), eine für den Hautton. Schatten und Glanz sind halbtransparentes Schwarz bzw. Weiß.
- Beim Laden ersetzt das Spiel die Platzhalter, wandelt die SVG in ein Bild um und speichert es pro tatsächlich benötigter Kombination zwischen. Der Canvas zeichnet nur fertige Bilder.
- Die SVGs im MVP zeichnen wir selbst (im Stil der Entwürfe). Sie sind bewusst einfach und sollen später ersetzt werden.

## 8. Bildschirme
1. **Start:** Neues Spiel, Spiel fortsetzen (falls vorhanden), Map-Editor, Map importieren.
2. **Neues Spiel:** Map wählen, Spieler anlegen (Name, Farbe).
3. **Übergabe:** zwischen allen Zügen, verdeckt die Karte komplett.
4. **Spiel:** Karte, oben Spieler und Runde, unten Infos zur gewählten Einheit oder Sportstätte (inkl. Produktion), Knopf „Zug beenden“.
5. **Editor:** Karte, Werkzeugleiste mit Pinseln, Export, Import, Testspiel.
6. **Sieg:** Gewinner und Rückkehr zum Start.

## 9. Architektur

### 9.1 Trennung
- **Configs:** Gelände, Bebauung, Sportstätten, Einheiten, Sonderfelder, Skins, Spielerfarben. Reine Daten.
- **Spiellogik:** ein reiner Spielzustand plus Funktionen ohne DOM- und Canvas-Zugriff. Testbar ohne Browser.
- **Darstellung:** Canvas-Renderer, liest nur den Zustand und die Sicht des aktuellen Spielers.
- **Eingabe/UI:** übersetzt Tippen in Aktionen.

### 9.2 Aktionen (Vorbereitung auf den Server)
- Jeder Spielzug ist eine **Aktion** (`move`, `attack`, `produce`, `endTurn`), die auf den Zustand angewendet wird: `apply(state, action) → newState`. Die Logik prüft jede Aktion auf Gültigkeit.
- Zufall (Skins) nutzt einen Zufallsgenerator mit Startwert im Zustand, damit das Ergebnis auf allen Geräten gleich ist.
- Hot-Seat ruft `apply` lokal auf. Später schickt ein Server dieselben Aktionen weiter.

### 9.3 Speichern und PWA
- Der Spielstand wird nach jeder Aktion im Browser gespeichert (z. B. `localStorage` oder IndexedDB). Eine Partie überlebt das Schließen der App.
- Ein Spielstand gleichzeitig reicht im MVP.
- `manifest.json` mit Name, Icon, Vollbild (Querformat und Hochformat erlaubt).
- Service Worker cached App, Configs, SVGs und alle Maps aus `maps/index.json`. Danach läuft das Spiel offline.

## 10. Mitgelieferte Maps
- Mindestens **3 Maps** im Repo: eine kleine für 2 Spieler zum Lernen, eine mittlere für 4 und eine große für 8 bis 16. Sie sollen die Regeln zeigen: Hügel und Wälder, die Schlagbahnen verändern, Straßen, Sonderfelder, um die gekämpft wird, verteilte neutrale Sportstätten.

## 11. Dem Builder überlassen
- Genaues JSON-Schema von Map und Spielstand.
- Ordner- und Modulstruktur.
- Konkrete 16 Spielerfarben (gut unterscheidbar, auch bei Farbschwäche so gut es geht).
- Bedienung im Detail (Gesten, Animationen, Menüs).
- Pfadsuche und Linienalgorithmus auf dem Hexraster.
- Testansatz für die Spiellogik.
- Feinheiten der Gelände-Zeichnung.

## 12. Aufräumen
- `CLAUDE.md` und `anforderungen.md` an diesen Stand anpassen (falsche Häkchen entfernen, Hex statt quadratisch, PWA in Phase 1, Ein-Datei-Regel aufheben).
- `git init`, `.superpowers/` in `.gitignore`.
