# Sports Battle Isle

Rundenbasiertes Strategiespiel auf Hex-Karte im Geiste von Battle Isle 2 – mit Sportlern statt Panzern.
Läuft als PWA im Browser und auf dem Handy, offline spielbar. Hot-Seat für 2 bis 16 Spieler an einem Gerät.

## Spielen

Kein Build nötig, nur ein statischer Webserver:

```bash
npx http-server -c-1 -p 8080
```

Dann `http://localhost:8080` öffnen.

## Spielprinzip

- Jeder Spieler startet mit wenigen Einheiten (von der Map vorgegeben) und erkundet die Karte.
- **Sportstätten** erobern (Zug darauf beenden) und dort neue Einheiten herstellen.
- **Nebel der Sicht:** Entdecktes Gelände bleibt bekannt, fremde Einheiten sieht man nur in Sichtweite.
- **Sonderfelder** geben 3 Züge lang einen Bonus.
- Verloren hat, wer weder Einheiten noch Sportstätten hat. Der Letzte gewinnt.

| Einheit | Schlagweite | Besonderheit |
|---|---|---|
| Golfer | 3 | schlägt über Hügel, nicht über Berge |
| Tennisspieler | 2 | Hügel und Gebäude blockieren |
| Hockeyspieler | 2 (im Wald 1) | viel Schaden, alles Bodennahe blockiert; 🧱 Kontrollzone |
| Jogger | – | schnell, sieht weit, erobert; darf Restbewegung für weitere Züge nutzen |
| Fußballer | 2 | 🧱 Kontrollzone; nach einem Treffer im nächsten Zug 🤕 angeschlagen (kein Angriff, halbe Bewegung) |
| Karateka | 1 | viel HP und Verteidigung; 🥋 schlägt zurück, wenn direkt daneben angegriffen |
| Rugbyspieler | – | hohe Verteidigung; 🏉 rammt nach mind. 2 Feldern Anlauf: Gegner wird 1 Feld weggedrückt, der Rugbyspieler nimmt seinen Platz ein (kann er nicht ausweichen, bleibt der Rugbyspieler davor stehen); ignoriert Kontrollzonen |
| Bergsteiger | 2 | wirft Steine; Hügel (auch hügeliger Wald) und Berge kosten ihn nur 1; auf dem Berg +2 Sicht und nichts blockiert seinen Wurf; bergab +1 Angriff und Reichweite |

Steht das Ziel auf einer Straße, reicht der Schlag 1 Feld weiter.

**Kontrollzone (🧱):** Wer ein Nachbarfeld eines gegnerischen Hockeyspielers oder Fußballers betritt, muss dort stehen bleiben. Der Jogger behält seine Restpunkte, darf aber nur genau zurück.

## Map-Editor

Gelände, Straßen, Gebäude, Sportstätten, Sonderfelder und Startpunkte malen.
Maps sind JSON-Dateien und lassen sich exportieren, importieren und weitergeben.
Mitgelieferte Maps liegen in `maps/` und sind in `maps/index.json` eingetragen.

## Entwicklung

- Reines HTML5 / Canvas / JavaScript (ES-Module), keine Abhängigkeiten.
- Alle Spielwerte in `src/config.js`, Spiellogik in `src/logic/` (ohne DOM).
- Figuren und Sportstätten als bearbeitbare SVGs in `units/` und `facilities/`.
- Tests: `npm test` (Node ≥ 21).
- Neue Dateien in `sw.js` (`SHELL`) eintragen und `CACHE` hochzählen – der Test meldet vergessene Einträge.

Design und Plan: `docs/superpowers/specs/` und `docs/superpowers/plans/`.
