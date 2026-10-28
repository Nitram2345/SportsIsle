# Sports Battle Isle MVP – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spielbare Hot-Seat-PWA (2–16 Spieler) auf Hex-Karte mit Nebel der Sicht, Sportstätten, Produktion, Sonderfeldern, Map-Editor und 3 mitgelieferten Maps.

**Architecture:** Reine Spiellogik in ES-Modulen ohne DOM (`src/logic/`), testbar mit `node --test`. Zustand ist ein JSON-Objekt, jede Änderung läuft über `apply(state, action)`. Canvas-Renderer (`src/render/`) liest Zustand plus Sicht des aktuellen Spielers. Gelände ist im Offscreen-Canvas vorgezeichnet. UI als DOM-Overlays (`src/ui/`).

**Tech Stack:** HTML5, Canvas 2D, Vanilla JS (ES-Module), kein Build, keine Laufzeit-Abhängigkeiten. Tests: Node ≥ 21 eingebauter Test-Runner (`node --test`, `node:assert/strict`). Lokaler Server zum Testen: `npx --yes http-server -c-1 -p 8080`.

**Spec:** `docs/superpowers/specs/2026-10-28-sports-battle-isle-mvp-design.md` – Executor liest Spec und Plan.

## Global Constraints

- Keine Spielwerte in der Logik. Alle Werte kommen aus `src/config.js`.
- Kein Framework, kein Bundler, keine npm-Laufzeit-Abhängigkeiten. `package.json` nur für `"type": "module"` und `"test"`.
- Logikmodule (`src/logic/*`, `src/config.js`) importieren nie DOM, Canvas oder `localStorage`.
- Zustand muss `JSON.parse(JSON.stringify(state))` unverändert überstehen: keine `Set`, `Map` oder Klassen im Zustand.
- Koordinaten: Pointy-Top-Hex, **odd-r Offset** `"c,r"` als String-Key im Zustand und `[c, r]` in Map-Dateien. Würfelkoordinaten nur intern in `hex.js`.
- Spieler-IDs sind Indizes `0..n-1`. Neutral = `null`.
- Ungültige Aktionen werfen `Error` mit deutscher Meldung. Die UI zeigt sie an.
- Alle Texte in der UI auf Deutsch.
- `localStorage`-Zugriff immer in try/catch. Ohne Storage läuft das Spiel, nur ohne Speichern.
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Werte aus der Spec (wörtlich): `unitCap: 50`, `slowdownFrom: 30`, `slowdownStep: 5`. Schaden `max(1, Angriff − (Verteidigung + Geländebonus))`. Bonus `{ stat, amount, turns }` mit `turns: 3`.

## Review Focus

1. **Entdeckungs-Stopp auf einem Feld mit eigener Einheit** (beim Durchlaufen). Erwartet: Die Einheit geht zurück zum letzten freien Feld des Weges und bekommt die Kosten der zurückgenommenen Schritte erstattet. Kein Stapeln. → Test in Task 4.
2. **Erreichbare Felder verraten keine versteckten Gegner.** Ein Feld mit unsichtbarer fremder Einheit erscheint als erreichbar. → Test in Task 4. Der Übergabe-Bildschirm verdeckt die Karte, bis getippt wird. → manuelle Prüfung in Task 9.
3. **Produktion, wenn Sportstätte und alle Nachbarn belegt sind.** Erwartet: wartet, kein Stapeln, kein Absturz, erscheint im nächsten möglichen Zug. → Test in Task 6.
4. **Kaputte oder fremde Map-Datei importiert** (falsches `format`, falsche Zeilenlänge, unbekanntes Zeichen, fehlende Felder). Erwartet: `validateMap` liefert Fehler, UI zeigt sie, nichts stürzt ab. → Test in Task 2.
5. **Spiel mit 16 Spielern, mehrere ausgeschieden.** Erwartet: Zugreihenfolge überspringt sie, Runde zählt beim Umlauf hoch, Sieg genau dann, wenn einer übrig ist. → Test in Task 6.

---

## Dateistruktur

```
index.html, style.css, manifest.json, sw.js, package.json, .gitignore
icons/icon.svg
src/config.js              alle Configs (Gelände, Bebauung, Einheiten, Sonderfelder, Skins, Farben, Regeln)
src/logic/hex.js           Hex-Mathematik
src/logic/map.js           Map laden/speichern/prüfen
src/logic/rng.js           Zufall mit Startwert
src/logic/vision.js        Sicht, Erinnerung
src/logic/movement.js      erreichbare Felder, Bewegung
src/logic/combat.js        Schlagweite, Schlagbahn, Angriff
src/logic/game.js          createGame, suggestStarts, apply, Züge, Produktion, Erobern
src/render/camera.js       Verschieben/Zoomen, Umrechnung Bildschirm ↔ Welt
src/render/terrain.js      Gelände zeichnen
src/render/sprites.js      SVG laden, einfärben, cachen
src/render/renderer.js     Bild zusammensetzen
src/ui/input.js            Pointer-Gesten
src/ui/game-view.js        Spielbildschirm, HUD, Übergabe, Sieg
src/ui/editor-view.js      Map-Editor
src/storage.js             localStorage
src/main.js                Start, Menüs, Routing, SW-Registrierung
units/{golfer,tennis,hockey,jogger}.svg
facilities/{golf,tennis,hockey,park,tabletennis,house}.svg
maps/index.json, maps/duell.json, maps/vierland.json, maps/archipel.json
tests/helpers.js, tests/*.test.js
```

---

### Task 1: Projekt anlegen und Hex-Mathematik

**Files:**
- Create: `package.json`, `.gitignore`, `src/logic/hex.js`, `tests/hex.test.js`
- Modify: `CLAUDE.md`, `anforderungen.md` (Spec Abschnitt 12)

**Interfaces:**
- Produces (`src/logic/hex.js`):
  - `key(c: number, r: number) -> string` → `"c,r"`
  - `parseKey(k: string) -> [number, number]`
  - `toCube(c, r) -> [x, y, z]` (odd-r: `x = c - (r - (r & 1)) / 2`, `z = r`, `y = -x - z`)
  - `distance(a: string, b: string) -> number`
  - `neighbors(k: string, width: number, height: number) -> string[]` – nur Felder innerhalb der Karte, feste Reihenfolge O, NO, NW, W, SW, SO
  - `hexesInRange(k: string, n: number, width, height) -> string[]` (inkl. `k`)
  - `lineBetween(a: string, b: string) -> string[][]` – Felder zwischen a und b (ohne Endpunkte). Jeder Eintrag hat 1 Key oder 2 Keys, wenn die Linie auf einer Kante liegt.
  - `hexToPixel(c, r, size) -> {x, y}` (Mitte des Feldes, Feld 0,0 bei `x = √3·size/2, y = size`)
  - `pixelToHex(x, y, size) -> string`

- [ ] **Step 1: Setup**

`git init`. `package.json`: `{ "name": "sports-battle-isle", "private": true, "type": "module", "scripts": { "test": "node --test" } }`. `.gitignore`: `.superpowers/`, `node_modules/`.
`CLAUDE.md`: Roadmap-Häkchen entfernen, „Hex von Anfang an“, PWA in Phase 1, Regel „eine Datei“ durch „mehrere ES-Module, kein Build“ ersetzen, Verweis auf die Spec. `anforderungen.md`: Häkchen unter „Aktueller Stand“ entfernen, Verweis auf die Spec.

- [ ] **Step 2: Failing tests schreiben** – `tests/hex.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { key, parseKey, distance, neighbors, hexesInRange, lineBetween, hexToPixel, pixelToHex } from '../src/logic/hex.js';

test('key/parseKey', () => { assert.equal(key(3, 4), '3,4'); assert.deepEqual(parseKey('3,4'), [3, 4]); });
test('distance', () => {
  assert.equal(distance('0,0', '2,0'), 2);
  assert.equal(distance('0,0', '3,2'), 4);
  assert.equal(distance('1,1', '2,2'), 1);
});
test('neighbors odd and even row', () => {
  assert.deepEqual(neighbors('1,1', 5, 5), ['2,1', '2,0', '1,0', '0,1', '1,2', '2,2']);
  assert.deepEqual(neighbors('2,2', 5, 5), ['3,2', '2,1', '1,1', '1,2', '1,3', '2,3']);
  assert.deepEqual(neighbors('0,0', 5, 5).sort(), ['0,1', '1,0']);
});
test('hexesInRange', () => { assert.equal(hexesInRange('5,5', 1, 20, 20).length, 7); assert.equal(hexesInRange('5,5', 2, 20, 20).length, 19); });
test('lineBetween straight', () => { assert.deepEqual(lineBetween('0,0', '3,0'), [['1,0'], ['2,0']]); });
test('lineBetween on edge gives both hexes', () => {
  const l = lineBetween('0,0', '1,1');
  assert.equal(l.length, 1);
  assert.deepEqual([...l[0]].sort(), ['0,1', '1,0']);
});
test('lineBetween neighbours is empty', () => { assert.deepEqual(lineBetween('0,0', '1,0'), []); });
test('pixel round trip', () => {
  for (const k of ['0,0', '3,4', '7,1']) { const [c, r] = parseKey(k); const p = hexToPixel(c, r, 32); assert.equal(pixelToHex(p.x, p.y, 32), k); }
});
```

- [ ] **Step 3: Tests laufen lassen** – `npm test` → FAIL (Modul fehlt).

- [ ] **Step 4: `src/logic/hex.js` implementieren**

`lineBetween` (nicht durch Tests eindeutig bestimmt):
```js
const EPS = [1e-6, 2e-6, -3e-6];
export function lineBetween(a, b) {
  const A = toCube(...parseKey(a)), B = toCube(...parseKey(b)), n = distance(a, b), out = [];
  for (let i = 1; i < n; i++) {
    const p = [0, 1, 2].map(j => A[j] + (B[j] - A[j]) * i / n);
    const k1 = cubeToKey(cubeRound(p.map((v, j) => v + EPS[j])));
    const k2 = cubeToKey(cubeRound(p.map((v, j) => v - EPS[j])));
    out.push(k1 === k2 ? [k1] : [k1, k2]);
  }
  return out;
}
```
`cubeRound` ist die übliche Rundung mit Korrektur der Achse mit der größten Abweichung. `cubeToKey`: `r = z`, `c = x + (r - (r & 1)) / 2`.

- [ ] **Step 5: Tests** – `npm test` → PASS.

- [ ] **Step 6: Commit** – `git add -A && git commit -m "chore: project setup and hex math"`

---

### Task 2: Configs und Map-Format

**Files:**
- Create: `src/config.js`, `src/logic/map.js`, `tests/helpers.js`, `tests/map.test.js`

**Interfaces:**
- Consumes: `hex.js` (`key`, `parseKey`)
- Produces (`src/config.js`, alles `export const`):
  - `TERRAIN`: `{ [id]: { name, char, move, def, passable, buildable, flags: string[] } }`, Werte aus Spec 4.3:

    | id | char | name | move | def | passable | buildable | flags |
    |---|---|---|---|---|---|---|---|
    | grass | G | Grasland | 1 | 0 | ✓ | ✓ | [] |
    | steppe | T | Steppe | 1 | 0 | ✓ | ✓ | [] |
    | beach | S | Strand | 1 | 0 | ✓ | ✓ | [] |
    | dunes | D | Dünen | 2 | 0 | ✓ | ✓ | ['ground'] |
    | hillgrass | g | hügeliges Grasland | 2 | 1 | ✓ | ✓ | ['hill'] |
    | hill | H | Hügel | 2 | 1 | ✓ | ✓ | ['hill'] |
    | forest | F | Wald | 2 | 1 | ✓ | ✓ | ['forest'] |
    | hillforest | h | hügeliger Wald | 3 | 2 | ✓ | ✓ | ['hill', 'forest'] |
    | moor | B | Moor | 3 | 0 | ✓ | ✗ | [] |
    | mountain | M | Berg | 3 | 2 | ✓ | ✗ | ['mountain'] |
    | river | R | Fluss | 3 | 0 | ✓ | ✗ | ['water'] |
    | lake | L | See | – | 0 | ✗ | ✗ | ['water'] |
    | sea | W | Meer | – | 0 | ✗ | ✗ | ['water'] |

    (Fluss nicht bebaubar: meine Entscheidung, die Spec nennt „Wasser“.) `ROAD_MOVE = 1`.
  - `TERRAIN_BY_CHAR`: `{ [char]: id }` (abgeleitet)
  - `BUILDINGS`: `{ [id]: { name, blocks: boolean, capturable: boolean, produces: string[], sight: number, svg } }`
    - `house` Gebäude: blocks ✓, capturable ✗, produces [], sight 0
    - `park` Park: blocks ✗, capturable ✓, produces ['jogger'], sight 1
    - `golf` Golfplatz: blocks ✓, capturable ✓, produces ['golfer'], sight 2
    - `tennis` Tennisanlage: ✓, ✓, ['tennis'], 1
    - `hockey` Hockeyplatz: ✓, ✓, ['hockey'], 1
    - `tabletennis` Tischtennishalle: ✓, ✓, [], 1
    - `svg: 'facilities/<id>.svg'`
  - `UNITS`: `{ [id]: { name, hp, atk, def, move, sight, build, range, blockedBy: string[], rangeOnFlag: {flag, range} | null, roadBonus, svg } }`, Werte aus Spec 6.3/6.4:
    - `golfer` Golfer: 8, 4, 1, 3, 3, 3, range 3, blockedBy ['mountain'], null, roadBonus 1
    - `tennis` Tennisspieler: 10, 5, 2, 3, 2, 2, range 2, ['mountain', 'hill', 'building'], null, 1
    - `hockey` Hockeyspieler: 10, 7, 2, 3, 2, 3, range 2, ['forest', 'hill', 'ground', 'mountain', 'building'], `{ flag: 'forest', range: 1 }`, 1
    - `jogger` Jogger: 6, 0, 1, 6, 4, 1, range 0, [], null, 0
    - `svg: 'units/<id>.svg'`. Das Flag `building` bedeutet „Feld hat Bebauung mit `blocks: true`“.
  - `SPECIALS`: `sprint` { name 'Sprint', stat 'move', amount 2, turns 3, icon '⚡' }, `power` { 'Kraftraum', 'atk', 2, 3, '💪' }, `shield` { 'Schutzschild', 'def', 1, 3, '🛡️' }
  - `SKINS`: `{ variants: ['m', 'f', 'd'], tones: ['#f1c27d', '#d9a066', '#a86b3c', '#6b4226'], hairPerVariant: 3 }`
  - `PLACEHOLDER`: `{ team: '#FF00FF', skin: '#00FFFF' }`
  - `PLAYER_COLORS`: 16 gut unterscheidbare Hex-Farben (Wahl des Builders, Spec 11). Index 0 = `#e63946`, Index 1 = `#2f6fd6` wie im Entwurf.
  - `RULES`: `{ unitCap: 50, slowdownFrom: 30, slowdownStep: 5, maxPlayers: 16 }`
- Produces (`src/logic/map.js`):
  - Laufzeitformat `MapData = { meta: { format: 1, id, name, author, width, height, players: { min, max } }, tiles: { [key]: Tile }, starts: Start[] }`
  - `Tile = { terrain: string, road: boolean, building: string | null, special: string | null }`
  - `Start = { at: string, units: string[], facilities: string[] }` (Slot-Index = Position im Array)
  - Dateiformat (JSON): `{ format, id, name, author, width, height, players, terrain: string[] /* eine Zeile pro r, ein Zeichen pro c aus TERRAIN.char */, roads: [c, r][], buildings: { at: [c, r], type }[], specials: { at: [c, r], type }[], starts: { at: [c, r], units: string[], facilities: [c, r][] }[] }`
  - `createEmptyMap({ id, name, author, width, height }) -> MapData` (alles `grass`, `players: { min: 2, max: 2 }`, keine Starts)
  - `loadMap(json) -> MapData` – wirft `Error` mit allen Fehlern aus `validateFile`, falls die Datei kaputt ist
  - `saveMap(mapData) -> object` (Dateiformat, `players.max = starts.length`)
  - `validateMap(mapData) -> string[]` – Spielbarkeit: ≥ 2 Starts, jeder Start hat ≥ 1 Einheit oder Sportstätte, Bebauung nur auf `buildable`, Start-Sportstätten sind `capturable`, Einheiten-IDs existieren
  - `canPlace(tile: Tile, buildingId: string) -> boolean`

- [ ] **Step 1: Test-Helfer** – `tests/helpers.js`

`mapFrom(rows: string[], { roads = [], buildings = {}, specials = {}, starts } = {}) -> MapData`. Baut MapData direkt aus Zeichenzeilen. Default `starts`: zwei Starts `'0,0'` und letzte Spalte/Zeile, jeweils `units: ['jogger']`. Wird in allen Logik-Tests genutzt (Task 3–6 erweitern ihn in Task 3 um `gameFrom`).

- [ ] **Step 2: Failing tests** – `tests/map.test.js`

```js
test('config: every unit blockedBy flag exists on some terrain or is "building"', ...);
test('saveMap/loadMap round trip', () => {
  const m = mapFrom(['GGFM', 'GHGW'], { roads: ['1,0'], buildings: { '2,1': 'golf' }, specials: { '0,1': 'sprint' },
    starts: [{ at: '0,0', units: ['golfer'], facilities: ['2,1'] }, { at: '3,0', units: ['jogger'], facilities: [] }] });
  assert.deepEqual(loadMap(JSON.parse(JSON.stringify(saveMap(m)))), m);
});
test('saveMap writes terrain rows as chars', () => assert.deepEqual(saveMap(mapFrom(['GF', 'MW'])).terrain, ['GF', 'MW']));
test('validateMap ok', () => assert.deepEqual(validateMap(mapFrom(['GGGG'])), []));
test('validateMap: fewer than 2 starts', () => assert.ok(validateMap(mapFrom(['GG'], { starts: [{ at: '0,0', units: ['jogger'], facilities: [] }] })).length));
test('validateMap: start without units and facilities', ...);
test('validateMap: building on mountain/sea/moor/river', ...);
test('canPlace', () => { assert.equal(canPlace({ terrain: 'mountain' }, 'golf'), false); assert.equal(canPlace({ terrain: 'grass' }, 'park'), true); });
// Review Focus 4
test('loadMap rejects broken files with messages', () => {
  for (const bad of [{}, { format: 2 }, { ...saveMap(mapFrom(['GG'])), terrain: ['G'] }, { ...saveMap(mapFrom(['GG'])), terrain: ['GX'] },
                     { ...saveMap(mapFrom(['GG'])), buildings: [{ at: [9, 9], type: 'golf' }] }, { ...saveMap(mapFrom(['GG'])), starts: [{ at: [0, 0], units: ['ninja'], facilities: [] }] }])
    assert.throws(() => loadMap(bad), /./);
});
```

- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** `src/config.js` und `src/logic/map.js` implementieren.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Commit** – `feat: configs and map format`

---

### Task 3: Spielaufbau, Zufall, Sicht

**Files:**
- Create: `src/logic/rng.js`, `src/logic/vision.js`, `src/logic/game.js` (Teil: `createGame`, `suggestStarts`, `apply`-Gerüst), `tests/setup.test.js`, `tests/vision.test.js`
- Modify: `tests/helpers.js`

**Interfaces:**
- Consumes: `hex.js`, `map.js` (`MapData`), `config.js`
- Produces:
  - `rng.js`: `random(holder: { rng: number }) -> number` in `[0, 1)`, mulberry32, setzt `holder.rng` weiter
  - Zustand `GameState`:
    ```
    { version: 1, rng, mapId, width, height, tiles: {[key]: Tile},
      players: [{ name, color, alive }], current, round, winner: number|null,
      units: { [id]: Unit }, nextId,
      facilities: { [key]: { type, owner: number|null, producing: string|null, progress, needed } },
      explored: [ { [key]: true } ],          // pro Spieler
      lastSeen: [ { [key]: number|null } ] }  // pro Spieler: zuletzt gesehener Besitzer
    Unit = { id: string, type, owner, at, hp, movesLeft, hasMoved, hasAttacked,
             skin: { variant, tone, hair }, buffs: [{ special, stat, amount, turns, fresh }] }
    ```
  - `game.js`: `createGame(map: MapData, players: {name, color}[], { seed: number, startSlots: number[] }) -> GameState` – Einheiten der gewählten Slots, Skins gewürfelt, Start-Sportstätten gehören dem Spieler, alle anderen `capturable`-Bebauungen neutral, Einheiten unbenutzter Slots fallen weg. Ruft am Ende `startTurn` für Spieler 0 auf.
  - `game.js`: `suggestStarts(map: MapData, n: number, seed: number) -> number[]` – Greedy-Verfahren mit größtem Mindestabstand: erster Slot zufällig, dann immer der Slot mit dem größten kleinsten Abstand zu den gewählten (bei Gleichstand der niedrigste Index). `// ponytail: greedy, nicht optimal; reicht für ≤16 Starts`
  - `game.js`: `apply(state, action) -> { state, events }` – `structuredClone`, dann Änderung. Gerüst hier, Aktionen in Task 4–6.
  - `vision.js`: `visibleTiles(state, pid) -> Set<string>` (Sicht eigener Einheiten `UNITS.sight + buff('sight')` und eigener Sportstätten `BUILDINGS.sight`, nur Abstand, kein Blockieren)
  - `vision.js`: `visibleUnits(state, pid) -> Unit[]` (eigene + fremde auf sichtbaren Feldern)
  - `vision.js`: `updateMemory(state, pid) -> void` (ändert: `explored` und `lastSeen` für sichtbare Felder)
  - `vision.js`: `effective(unit, stat) -> number` (`UNITS[type][stat]` + Summe passender Buffs)
- `tests/helpers.js`: `gameFrom(rows, opts, { players = 2, seed = 1 } = {}) -> GameState`; `place(state, type, owner, at) -> Unit` (fügt Einheit direkt ein, volle `movesLeft`)

- [ ] **Step 1: Failing tests** – `tests/setup.test.js`

```js
test('createGame: chosen slots get units, unused dropped, facilities neutral', () => {
  const m = mapFrom(['GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG', 'GGGGGGGGG'], {
    buildings: { '1,0': 'tennis', '4,3': 'golf' },
    starts: [{ at: '0,0', units: ['golfer', 'jogger'], facilities: ['1,0'] },
             { at: '8,0', units: ['hockey'], facilities: [] },
             { at: '4,4', units: ['tennis'], facilities: ['4,3'] }] });
  const s = createGame(m, [{ name: 'A', color: '#e63946' }, { name: 'B', color: '#2f6fd6' }], { seed: 1, startSlots: [0, 1] });
  assert.equal(Object.keys(s.units).length, 3);
  assert.equal(s.facilities['1,0'].owner, 0);
  assert.equal(s.facilities['4,3'].owner, null);
  for (const u of Object.values(s.units)) assert.ok(SKINS.variants.includes(u.skin.variant));
});
test('same seed gives same skins, other seed differs somewhere', ...);
test('suggestStarts spreads players', () => {
  const m = mapFrom(['GGGGGGGGGGG'], { starts: ['0,0', '1,0', '9,0', '10,0'].map(at => ({ at, units: ['jogger'], facilities: [] })) });
  for (let seed = 1; seed < 20; seed++) { const [a, b] = suggestStarts(m, 2, seed).map(i => m.starts[i].at); assert.ok(distance(a, b) >= 9); }
});
// Review Focus: Speichern/Laden
test('state survives JSON round trip and still plays', () => {
  const s = gameFrom(['GGGG']); const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  assert.equal(apply(copy, { type: 'endTurn' }).state.current, 1);
});
```
(`endTurn` kommt erst in Task 6. Den letzten Test `todo` markieren, bis Task 6 fertig ist, dann scharf schalten.)

`tests/vision.test.js`:
```js
test('golfer sight 3', () => { const s = gameFrom(Array(12).fill('G'.repeat(12))); place(s, 'golfer', 0, '5,5');
  const v = visibleTiles(s, 0); assert.ok(v.has('8,5')); assert.ok(!v.has('9,5')); });
test('own facility gives sight, neutral does not', ...);  // golf sight 2
test('foreign unit outside sight is not in visibleUnits', ...);
test('explored stays after unit leaves', ...);           // updateMemory, dann Einheit versetzen, updateMemory
test('lastSeen keeps old owner while unseen', ...);       // Besitzer ändern, ohne dass der Betrachter sieht → lastSeen alt
test('effective adds buffs', ...);
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `rng.js`, `vision.js`, `game.js` (Aufbau) implementieren. Unit-IDs: `'u' + nextId++`. Skin: `variant` aus `SKINS.variants`, `tone` Index 0–3, `hair` Index `0..hairPerVariant-1`, alles über `random(state)`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** – `feat: game setup, seeded rng, vision`

---

### Task 4: Bewegung mit Entdecken und Sonderfeldern

**Files:**
- Create: `src/logic/movement.js`, `tests/movement.test.js`
- Modify: `src/logic/game.js` (`apply` Fall `move`)

**Interfaces:**
- Consumes: `hex.js`, `vision.js`, `config.js`
- Produces:
  - `moveCost(tile: Tile) -> number | Infinity` (`road` → `ROAD_MOVE`, sonst `TERRAIN.move`, unpassierbar → `Infinity`)
  - `reachable(state, unitId) -> { [key]: string[] }` – Ziel → Weg (ohne Start). Dijkstra über `movesLeft`. **Sichtbare** fremde Einheiten blockieren, **unsichtbare werden ignoriert**. Eigene Einheiten sind passierbar, aber kein Ziel.
  - `doMove(state, unit, path, events) -> void` (ändert den Klon)
  - Aktion: `{ type: 'move', unitId, path: string[] }`
  - Events: `{ type: 'discovered', unitId, seen: string[] }`, `{ type: 'buff', unitId, special }`

**Regeln für `doMove`** (aus der Spec, hier festgelegt):
1. Prüfen: Einheit gehört `current`, `!hasAttacked`, jeder Schritt benachbart und passierbar, keiner auf **sichtbarer** fremder Einheit, Summe Kosten ≤ `movesLeft`, letztes Feld ohne eigene Einheit. Sonst `throw`.
2. `seenBefore` = IDs fremder Einheiten in `visibleUnits(state, owner)`.
3. Schritt für Schritt: Steht auf dem nächsten Feld eine fremde Einheit → Abbruch vor dem Feld (sie wird sichtbar). Sonst Feld betreten, `movesLeft -= cost`, Sonderfeld → Buff `{ special, stat, amount, turns, fresh: true }` setzen oder ersetzen (gleiche `special`), `updateMemory`. Ist jetzt eine fremde Einheit sichtbar, die nicht in `seenBefore` war → Abbruch.
4. Bei Abbruch auf einem Feld mit eigener Einheit: zurück zum letzten freien Feld des gelaufenen Weges, Kosten der zurückgenommenen Schritte erstatten.
5. `hasMoved = true`. Erobern macht `apply` danach (Task 6).

- [ ] **Step 1: Failing tests** – `tests/movement.test.js`

```js
test('jogger reaches 6 on grass', ...);                              // '6,0' erreichbar von '0,0' in GGGGGGGG, '7,0' nicht
test('forest costs 2, road makes it 1', ...);
test('water impassable', ...);
test('own unit passable, not a destination', ...);
test('visible enemy blocks', ...);
// Review Focus 2
test('hidden enemy tile still shows as reachable', () => {
  // Jogger Sicht 4, movesLeft auf 8 gesetzt (wie mit Sprint-Buff); Gegner auf Abstand 6 = unsichtbar
  const s = gameFrom(['G'.repeat(14)]); const j = place(s, 'jogger', 0, '0,0'); j.movesLeft = 8;
  place(s, 'tennis', 1, '6,0');
  assert.ok(reachable(s, j.id)['6,0']);
  assert.ok(reachable(s, j.id)['8,0']);
});
test('move stops when enemy discovered, keeps remaining points', () => {
  // Jogger '0,0' movesLeft 6, Gegner auf '9,0' (Abstand 9). Weg bis '6,0'.
  // Nach Schritt auf '5,0' ist '9,0' in Sicht 4 → Stopp auf '5,0', movesLeft 1, Event discovered.
});
test('after stop the unit can move again but cannot attack', ...);
// Review Focus 1
test('stop on own-occupied tile backs up to last free tile and refunds', () => {
  // Eigener Tennisspieler auf '5,0'. Gegner so, dass er genau beim Betreten von '5,0' sichtbar wird.
  // Erwartet: Jogger steht auf '4,0', movesLeft = 6 - 4.
});
test('special gives buff; move bonus not in current movesLeft', ...);
test('re-entering same special resets turns', ...);
test('invalid paths throw', ...);  // nicht benachbart, zu teuer, fremde Einheit (nicht current), Ziel eigene Einheit
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `movement.js` implementieren, in `apply` einhängen.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** – `feat: movement with discovery stop and specials`

---

### Task 5: Kampf

**Files:**
- Create: `src/logic/combat.js`, `tests/combat.test.js`
- Modify: `src/logic/game.js` (`apply` Fall `attack`, Prüfung auf Ausscheiden und Sieg)

**Interfaces:**
- Consumes: `hex.js` (`distance`, `lineBetween`), `vision.js` (`visibleUnits`, `effective`), `config.js`
- Produces:
  - `attackRange(state, unit, targetAt) -> number` (`rangeOnFlag` greift, wenn das eigene Feld das Flag hat; + `effective(unit,'range') - UNITS.range`; + `roadBonus`, wenn `tiles[targetAt].road`)
  - `pathBlocked(state, unit, targetAt) -> boolean` (ein Schritt blockiert nur, wenn **alle** seine Keys blockieren; Key blockiert, wenn Gelände-Flags ∩ `blockedBy` oder `'building'` in `blockedBy` und `BUILDINGS[tile.building]?.blocks`; Key außerhalb der Karte blockiert nicht)
  - `damage(state, attacker, target) -> number` = `max(1, effective(a,'atk') - (effective(t,'def') + TERRAIN[tile].def))`
  - `attackTargets(state, unitId) -> string[]` (IDs)
  - Aktion: `{ type: 'attack', unitId, targetId }`. Setzt `hasAttacked = true`, `movesLeft = 0`. Ziel bei `hp ≤ 0` entfernen.
  - `game.js`: `checkElimination(state, events) -> void` nach jeder Aktion. Spieler ohne Einheiten und ohne Sportstätten → `alive = false`. Bleibt genau einer übrig → `winner`.
  - Events: `{ type: 'damage', targetId, amount }`, `{ type: 'killed', unitId }`, `{ type: 'eliminated', player }`, `{ type: 'won', player }`

- [ ] **Step 1: Failing tests** – `tests/combat.test.js`

```js
test('golfer hits over hill, not over mountain', ...);       // 'GHG G' vs 'GMG'
test('tennis blocked by hill and by building, golfer not by building', ...);
test('hockey blocked by forest, dunes, building; not by park', ...);
test('hockey in forest has range 1', ...);
test('road bonus when target on road', ...);                  // Tennis Abstand 3: auf Straße ja, sonst nein
test('edge line blocked only if both hexes block', ...);      // lineBetween('0,0','1,1'): ein Hügel → frei, zwei → blockiert (Tennis)
test('damage uses terrain defence and min 1', () => {
  // Hockey atk 7 vs Tennis def 2 auf Wald (+1) → 4. Jogger atk 0 nicht angriffsfähig. Golfer atk 4 vs Hockey def 2 auf hillforest (+2) → max(1,0)=1
});
test('cannot attack after moving / twice / hidden target', ...);
test('kill removes unit; last player standing wins', ...);
test('player with facility but no units stays alive', ...);
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** implementieren.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** – `feat: combat with line of fire rules`

---

### Task 6: Züge, Buffs, Erobern, Produktion

**Files:**
- Modify: `src/logic/game.js`, `tests/setup.test.js` (Round-Trip-Test scharf schalten)
- Create: `tests/turns.test.js`

**Interfaces:**
- Consumes: alles Vorherige
- Produces (`game.js`):
  - Aktion `{ type: 'endTurn' }`:
    1. Eigene Einheiten auf fremder `capturable`-Sportstätte erobern.
    2. Buffs eigener Einheiten: `fresh` → `false`, sonst `turns--`, bei 0 entfernen.
    3. Nächster lebender Spieler. Beim Umlauf `round++`.
    4. `startTurn(state, pid, events)`: Produktion ticken (zuerst), dann alle eigenen Einheiten zurücksetzen (`movesLeft = effective(u,'move')`, `hasMoved = hasAttacked = false`), dann `updateMemory`.
  - Nach `move`: Endet die Bewegung auf einer fremden `capturable`-Sportstätte → sofort erobern.
  - Erobern: `owner = pid`, `producing = null`, `progress = 0`. Event `{ type: 'captured', at, player }`.
  - `productionTime(state, pid, unitType) -> number | null` = `UNITS.build + extra`, `extra = count < slowdownFrom ? 0 : floor((count - slowdownFrom) / slowdownStep) + 1`. `null`, wenn `count >= unitCap`. `count` = Einheiten des Spielers.
  - Aktion `{ type: 'produce', at, unitType: string | null }`: nur eigene Sportstätte, Typ in `produces`. Setzt `producing`, `progress = 0`, `needed = productionTime(...)`. `null` stoppt.
  - Produktions-Tick: wenn `count >= unitCap` → nichts. Sonst `progress++`. Bei `progress >= needed`: Einheit auf das Feld setzen, sonst auf den ersten freien passierbaren Nachbarn (Reihenfolge `neighbors`). Ist nichts frei → warten (`progress` bleibt). Nach dem Erscheinen: `progress = 0`, `needed` neu berechnen (wiederholt sich). Event `{ type: 'produced', unitId }`.

- [ ] **Step 1: Failing tests** – `tests/turns.test.js`

```js
test('endTurn resets units of next player and increments round on wrap', ...);
// Review Focus 5
test('16 players: eliminated players are skipped, winner when one left', () => {
  // gameFrom mit 16 Starts, players: 16. Spieler 3,4,5 alle Einheiten entfernen + checkElimination via apply(endTurn).
  // current läuft 2 → 6. Danach alle außer 9 eliminieren → winner === 9.
});
test('buff lasts exactly 3 own turns after pickup turn', () => {
  // Pickup im Zug T (move auf sprint). Start T+1, T+2, T+3: movesLeft = 6 + 2. Start T+4: movesLeft = 6.
});
test('capture when move ends on facility', ...);
test('capture at endTurn when unit started on facility', ...);
test('capture cancels production', ...);
test('passing over facility does not capture', ...);
test('produce: unit appears after build turns and repeats', () => {
  // Tennisanlage, build 2. produce → nach 2 eigenen Zugstarts eine neue Einheit, nach 2 weiteren noch eine.
});
// Review Focus 3
test('spawn waits when facility and all neighbours are blocked', ...);
test('slowdown table', () => {
  // Spieler-Einheiten auf count setzen: 29 → build+0, 30 → +1, 34 → +1, 35 → +2, 45 → +4, 50 → null
});
test('cap pauses production', ...);
test('produce invalid: foreign facility, wrong unit type', ...);
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** implementieren. Round-Trip-Test in `setup.test.js` von `todo` auf aktiv.
- [ ] **Step 4:** `npm test` → alle PASS.
- [ ] **Step 5: Commit** – `feat: turns, buffs, capture, production`

---

### Task 7: Renderer – Kamera und Gelände

**Files:**
- Create: `src/render/camera.js`, `src/render/terrain.js`, `src/render/renderer.js`, `index.html` (minimal: Vollbild-Canvas `#board` + `<script type="module" src="src/main.js">`), `src/main.js` (vorläufig: baut eine Testkarte mit allen 13 Geländearten über `createEmptyMap` und zeichnet sie), `style.css`

**Interfaces:**
- Consumes: `hex.js` (`hexToPixel`, `pixelToHex`, `parseKey`), `config.js`
- Produces:
  - `camera.js`: `createCamera() -> { x, y, zoom }`; `screenToWorld(cam, sx, sy) -> {x, y}`; `worldToScreen(cam, wx, wy) -> {x, y}`; `zoomAt(cam, factor, sx, sy) -> void` (Zoom 0.4–3)
  - `terrain.js`: `paintTerrain(ctx, tiles, width, height, size) -> void` – zeichnet Gelände, Straßen (durchgehend von Mitte zu Mitte benachbarter Straßenfelder), Sonderfeld-Markierung. Bebauung **nicht** (kommt als Sprite). Variation pro Feld deterministisch (Zufall mit Startwert aus `c * 73856093 ^ r * 19349663`). Stil: Portierung von `docs/design-reference/look-v3.html` (Farben, Baumkronen, Hügelbuckel, Berge mit Schnee, Dünen- und Wasserwellen, Moortümpel).
  - `renderer.js`: `HEX_SIZE = 32`; `createRenderer(canvas) -> { setMap(tiles, width, height), draw(view), resize() }`
    - `setMap` zeichnet das Gelände einmal in einen Offscreen-Canvas. `// ponytail: ein Offscreen für die ganze Karte; bei >60×60 in Kacheln teilen`
    - `view = { camera, state: GameState | null, viewer: number | null, tiles, starts?: Start[], selected?: string, reach?: string[], targets?: string[] }`. `viewer = null` → alles sichtbar (Editor).
    - Reihenfolge: Gelände-Offscreen → Markierungen (erreichbar blau getönt, Ziele rot gestrichelt, Auswahl gelber Rand) → Bebauung (Sprite + Innenrand in Besitzerfarbe aus `lastSeen[viewer]`, grau neutral) → Einheiten (nach `y` sortiert, Sprite ragt über den Rand, Schatten-Ellipse, Lebensbalken, Buff-Symbol) → Nebel (`explored` aber nicht sichtbar: `rgba(20,30,50,.55)`, nie gesehen: `#0d1520`) → im Editor Startpunkte (Kreis mit Nummer).
    - Zeichnet nur bei Bedarf: `draw` setzt ein Dirty-Flag, ein `requestAnimationFrame` zeichnet. Keine Dauerschleife.
    - Bis Task 8 fertig ist: Platzhalter-Kreise in Spielerfarbe für Einheiten und Bebauung.

- [ ] **Step 1:** Implementieren. Keine Unit-Tests (Darstellung).
- [ ] **Step 2: Manuell prüfen** – `npx --yes http-server -c-1 -p 8080`, `http://localhost:8080` öffnen. Erwartet: Testkarte mit allen 13 Geländearten, Straße, Brücke über Fluss. Mausrad zoomt, Ziehen verschiebt (provisorisch direkt in `main.js`). DevTools → Performance: Verschieben ohne Ruckeln.
- [ ] **Step 3:** `npm test` → weiterhin PASS.
- [ ] **Step 4: Commit** – `feat: canvas renderer with battle-isle style terrain`

---

### Task 8: Figuren und Sportstätten als SVG

**Files:**
- Create: `units/golfer.svg`, `units/tennis.svg`, `units/hockey.svg`, `units/jogger.svg`, `facilities/{golf,tennis,hockey,park,tabletennis,house}.svg`, `src/render/sprites.js`, `tests/assets.test.js`
- Modify: `src/render/renderer.js` (Platzhalter durch Sprites ersetzen)

**Interfaces:**
- Consumes: `config.js` (`UNITS[*].svg`, `BUILDINGS[*].svg`, `SKINS`, `PLACEHOLDER`)
- Produces:
  - **SVG-Vertrag Einheiten:** `viewBox="-24 -48 48 52"`, Füße bei `y = 0`. Drei Gruppen `<g id="m">`, `<g id="f">`, `<g id="d">`. In jeder Gruppe `hairPerVariant` Gruppen `<g id="m-hair-0">` … Teamfarbe nur als exakt `#FF00FF`, Haut nur als exakt `#00FFFF`. Schatten/Glanz als `rgba(0,0,0,.3)` bzw. `rgba(255,255,255,.38)`. Dünner dunkler Umriss in der Datei. Stil wie `docs/design-reference/look-v3.html`. Divers: androgyn, neutrale Statur und Frisur.
  - **SVG-Vertrag Sportstätten:** `viewBox="-28 -28 56 56"`, Mitte = Feldmitte, ragt leicht über den Hex hinaus (Hex-Radius 24 in diesen Einheiten). Kein Spielerfarben-Rand in der Datei (zeichnet der Renderer).
  - `sprites.js`: `preloadSvgs() -> Promise<void>` (lädt alle SVG-Texte); `getUnitSprite(type, color, skin) -> HTMLImageElement | null`; `getFacilitySprite(type) -> HTMLImageElement | null`; `onSpriteReady(cb)`. Einfärben: Text kopieren, andere Varianten- und Frisur-Gruppen per `DOMParser` entfernen, `#FF00FF` → Spielerfarbe, `#00FFFF` → `SKINS.tones[skin.tone]`, als Blob-URL in ein `Image` laden. Cache-Key `type|color|variant|tone|hair`. `null`, solange noch nicht geladen. Der Renderer zeichnet neu bei `onSpriteReady`.

- [ ] **Step 1: Failing test** – `tests/assets.test.js`

```js
import { readFileSync } from 'node:fs';
test('every unit svg has variants, hair groups and placeholders', () => {
  for (const u of Object.values(UNITS)) {
    const svg = readFileSync(u.svg, 'utf8');
    assert.match(svg, /#FF00FF/i); assert.match(svg, /#00FFFF/i);
    for (const v of SKINS.variants) { assert.match(svg, new RegExp(`id="${v}"`));
      for (let h = 0; h < SKINS.hairPerVariant; h++) assert.match(svg, new RegExp(`id="${v}-hair-${h}"`)); }
  }
});
test('every building svg exists', () => { for (const b of Object.values(BUILDINGS)) assert.ok(readFileSync(b.svg, 'utf8').includes('<svg')); });
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** SVGs zeichnen, `sprites.js` implementieren, Renderer umstellen.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Manuell prüfen** – Testkarte im Browser: alle 4 Einheiten × 3 Varianten in 4 Farben. Gelände unter den Figuren sichtbar, Teamfarbe mit Schatten und Glanz, grüne Figur im Wald erkennbar. Sportstätten mit Innenrand in Besitzerfarbe.
- [ ] **Step 6: Commit** – `feat: svg unit and facility sprites with team colors and skins`

---

### Task 9: Spiel-UI (Hot-Seat)

**Files:**
- Create: `src/ui/input.js`, `src/ui/game-view.js`, `src/storage.js`
- Modify: `index.html`, `style.css`, `src/main.js`

**Interfaces:**
- Consumes: `game.js` (`createGame`, `suggestStarts`, `apply`), `movement.js` (`reachable`), `combat.js` (`attackTargets`), `vision.js` (`visibleUnits`), `map.js` (`loadMap`), `renderer.js`, `camera.js`
- Produces:
  - `input.js`: `attachInput(canvas, { onTap(sx, sy), onPan(dx, dy), onZoom(factor, sx, sy), onPaint?(sx, sy), mode: () => 'pan' | 'paint' }) -> detach()` – Pointer Events. Ein Finger: Tippen (< 8 px Bewegung) oder Ziehen (Pan bzw. Paint). Zwei Finger: Pan + Pinch-Zoom. Mausrad zoomt.
  - `storage.js`: `saveGame(state)`, `loadGame() -> GameState | null`, `clearGame()`, `listLocalMaps() -> object[]`, `saveLocalMap(json)`, `deleteLocalMap(id)`. Keys `sbi.save`, `sbi.maps`. Alles in try/catch.
  - `game-view.js`: `startGameView(state, { onExit }) -> void`
  - Bildschirme in `index.html` als `<section data-screen="...">`: `start`, `new`, `handoff`, `game` (Canvas + HUD oben/unten), `victory`. Ab Task 10 auch `editor`. `main.js`: `show(name)`.
- Verhalten:
  - **Start:** „Neues Spiel“, „Spiel fortsetzen“ (nur wenn `loadGame()`), „Map-Editor“, „Map importieren“.
  - **Neues Spiel:** Map-Liste aus `maps/index.json` + `listLocalMaps()`. Spielerzahl 2..`starts.length` (max 16). Je Spieler Name + Farbe (Standard `PLAYER_COLORS[i]`, keine doppelten Farben). Startpunkte über `suggestStarts`, Knopf „Neu würfeln“, Vorschau-Karte mit Nummern. `seed = Date.now()`.
  - **Übergabe** vor jedem Zug: Vollbild in Spielerfarbe, „Gerät an <Name> geben – tippen zum Start“. Die Karte wird **nicht** gezeichnet, bis getippt wurde.
  - **Spiel:** Tippen auf eigene Einheit → Auswahl, `reach` + `targets` anzeigen. Tippen auf erreichbares Feld → `move`. Tippen auf Ziel → `attack`. Tippen auf eigene Sportstätte → unten Produktionsauswahl (Typen aus `produces`, Bauzeit aus `productionTime`, Fortschritt, „Stopp“). Events kurz einblenden („Feind entdeckt!“, „Tennisanlage erobert“, „Spieler 7 ist ausgeschieden“). Fehler aus `apply` als Hinweis. „Zug beenden“ → `endTurn` → Übergabe. Kamera beim Zugstart auf eine eigene Einheit oder Sportstätte.
  - Nach jeder Aktion `saveGame(state)`. Bei `winner !== null` → Sieg-Bildschirm, `clearGame()`.

- [ ] **Step 1:** Implementieren.
- [ ] **Step 2: Manuell prüfen** (Server wie Task 7, Handy-Ansicht in DevTools + echtes Handy im WLAN, falls möglich). Checkliste:
  - 3 Spieler auf einer Map mit 4 Starts: Startpunkte weit auseinander, „Neu würfeln“ ändert sie.
  - Übergabe verdeckt die Karte komplett (Review Focus 2).
  - Bewegen, Entdecken mit Stopp und Restbewegung, Schlagen, Erobern, Produktion starten, Einheit erscheint.
  - Seite neu laden mitten im Zug → „Spiel fortsetzen“ stellt alles wieder her.
  - Touch: Tippen, Wischen, Pinch funktionieren. Drehen des Handys passt den Canvas an.
- [ ] **Step 3:** `npm test` → PASS.
- [ ] **Step 4: Commit** – `feat: hot-seat game ui with handoff and save`

---

### Task 10: Map-Editor

**Files:**
- Create: `src/ui/editor-view.js`
- Modify: `index.html`, `style.css`, `src/main.js`

**Interfaces:**
- Consumes: `map.js` (`createEmptyMap`, `loadMap`, `saveMap`, `validateMap`, `canPlace`), `renderer.js` (`viewer: null`, `starts`), `input.js` (`mode: 'paint'`), `storage.js`
- Produces: `startEditorView(mapData | null, { onExit, onTestPlay(mapData) }) -> void`
- Verhalten (Spec 5):
  - Neue Map: Name, Breite, Höhe (je 6–40).
  - Werkzeugleiste: Gelände (13), Straße an/aus, Bebauung (6 + entfernen), Sonderfeld (3 + entfernen), Startpunkt (setzen/entfernen), „Hand“ (Pan-Modus). Malen mit Tippen und Ziehen. Zwei Finger verschieben und zoomen immer.
  - Ungültige Bebauung (`canPlace` false) wird nicht gesetzt, kurzer Hinweis. Wird Gelände unter einer Bebauung ungültig, verschwindet die Bebauung.
  - Tippen auf einen Startpunkt im Startpunkt-Werkzeug → Panel: Einheiten hinzufügen/entfernen (Liste aus `UNITS`), angrenzende oder beliebige Sportstätten über „Sportstätte zuordnen“ + Tippen auf die Karte.
  - **Export:** `validateMap` → Fehler anzeigen, sonst Download `<id>.json` (Blob + `<a download>`). `id` aus dem Namen (Kleinbuchstaben, `-`).
  - **Import:** `<input type="file" accept=".json">` → `loadMap`. Fehler anzeigen. Danach im Editor öffnen und mit `saveLocalMap` speichern.
  - Automatisch `saveLocalMap` bei jeder Änderung (entprellt 1 s).
  - **Testspiel:** `onTestPlay(mapData)` → Neues-Spiel-Bildschirm mit dieser Map.

- [ ] **Step 1:** Implementieren.
- [ ] **Step 2: Manuell prüfen** – Map 12×10 malen (alle Schichten), 2 Startpunkte mit Einheiten, Export, Datei wieder importieren → identisch. Kaputte JSON-Datei importieren → Fehlermeldung, kein Absturz (Review Focus 4). Testspiel starten.
- [ ] **Step 3:** `npm test` → PASS.
- [ ] **Step 4: Commit** – `feat: map editor with import and export`

---

### Task 11: Mitgelieferte Maps

**Files:**
- Create: `maps/index.json`, `maps/duell.json`, `maps/vierland.json`, `maps/archipel.json`, `tests/maps.test.js`

**Interfaces:**
- Consumes: Dateiformat aus Task 2
- Produces: `maps/index.json` = `[{ id, name, file, players: { min, max }, width, height }]`
- Maps (Spec 10):
  - `duell` „Insel-Duell“: ca. 14×12, 2 Starts. Lernkarte. Jeder Start: 1 Golfer, 1 Tennis, 1 Jogger + eigene Tennisanlage. Neutral in der Mitte: Golfplatz, Park, 1 Sonderfeld. Ein Hügelzug, der Tennis blockt, aber nicht Golf. Ein Wald als Hockey-Falle.
  - `vierland` „Vierland“: ca. 22×18, 4 Starts. Fluss mit 2 Brücken, Straßennetz, je Start 1 eigene Sportstätte, 6 neutrale Sportstätten, 3 Sonderfelder.
  - `archipel` „Archipel“: ca. 40×36, 16 Starts auf Inseln, die durch Strand, Dünen und Furten (Fluss) verbunden sind. Je Start 2 Einheiten (Jogger + eine weitere) + Park. Verteilte neutrale Sportstätten aller Typen und Sonderfelder.
  - Erstellung: von Hand als JSON oder im Editor (Task 10) und exportiert.

- [ ] **Step 1: Failing test** – `tests/maps.test.js`

```js
test('every indexed map loads, validates and matches index', () => {
  const index = JSON.parse(readFileSync('maps/index.json', 'utf8'));
  assert.equal(index.length, 3);
  for (const e of index) {
    const m = loadMap(JSON.parse(readFileSync(`maps/${e.file}`, 'utf8')));
    assert.deepEqual(validateMap(m), []);
    assert.equal(m.meta.id, e.id); assert.equal(m.starts.length, e.players.max);
    assert.equal(m.meta.width, e.width); assert.equal(m.meta.height, e.height);
  }
});
test('archipel supports 16 players', ...);
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Maps erstellen.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Manuell prüfen** – Jede Map im Spiel starten (2, 4, 16 Spieler). Erster Zug spielbar, kein Ruckeln auf `archipel`.
- [ ] **Step 6: Commit** – `feat: three bundled maps`

---

### Task 12: PWA

**Files:**
- Create: `manifest.json`, `sw.js`, `icons/icon.svg`
- Modify: `index.html` (`<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-capable`, Viewport `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`), `src/main.js` (SW registrieren)

**Interfaces:**
- `manifest.json`: `name` „Sports Battle Isle“, `short_name` „SportsIsle“, `display: "fullscreen"`, `orientation: "any"`, `start_url: "./"`, `background_color` `#1d3a5c`, Icon `icons/icon.svg` (`sizes: "any"`, `purpose: "any maskable"`).
- `sw.js`: `const CACHE = 'sbi-v1'`. Install: feste Liste `SHELL` (alle Dateien unter `/`, `src/`, `units/`, `facilities/`, `icons/`, `maps/index.json`) cachen, dann `maps/index.json` lesen und alle `file`-Einträge dazu. Fetch: Cache zuerst, sonst Netz. Activate: alte Caches löschen. `// ponytail: SHELL von Hand pflegen; bei neuen Dateien ergänzen und CACHE hochzählen`

- [ ] **Step 1:** Implementieren.
- [ ] **Step 2: Manuell prüfen** – Chrome DevTools → Application: Manifest ohne Fehler, SW aktiv. Offline-Haken setzen, neu laden → Spiel startet, alle 3 Maps spielbar. Lighthouse-PWA-Prüfung: installierbar.
- [ ] **Step 3:** `npm test` → PASS.
- [ ] **Step 4: Commit** – `feat: pwa manifest and offline service worker`
