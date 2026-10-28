# Claude Code Project Guidelines - Sports Battle Isle

## Project Overview
A data-driven, turn-based strategy game (TBS) for mobile (PWA) on a hex grid, combining sports facilities (production) with tactical combat (sports units). Hot-seat for 2-16 players; a map editor and shareable map files are core features.

**Design spec (binding):** `docs/superpowers/specs/2026-10-28-sports-battle-isle-mvp-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-10-28-sports-battle-isle-mvp.md`

## Tech Stack
- **Frontend:** HTML5 Canvas, Vanilla JavaScript (ES modules), CSS3. No framework, no build step.
- **Target:** Progressive Web App (PWA), offline-capable.
- **Architecture:** Data-driven (all gameplay values in `src/config.js`).
- **Multiplayer Pattern:** Hot-seat (current) -> server relaying actions (future).
- **Tests:** `npm test` (Node built-in test runner, logic only).

## Development Standards

### 1. Data-Driven Design
- **DO NOT** hardcode unit stats in logic.
- **ALWAYS** use the configs in `src/config.js` (TERRAIN, BUILDINGS, UNITS, SPECIALS, SKINS, RULES).
- New units, terrain or special fields are added by extending configuration objects.

### 2. Code Structure
- **Logic/View Separation:** `src/logic/` is pure (no DOM, Canvas, storage). State is plain JSON; every change goes through `apply(state, action)`.
- **Rendering:** `src/render/`, UI: `src/ui/`. Unit/facility graphics are SVG files in `units/` and `facilities/` with placeholder colors.
- Multiple ES modules, no bundler.

### 3. Gameplay Rules (The "Battle Isle" Feel)
- **Movement vs. Attack:** Moving consumes the ability to attack in the same turn.
- **Combat Calculation:** `damage = max(1, attacker.attack - (defender.defense + terrain bonus))`.
- **Turn Management:** Reset `hasMoved`, `hasAttacked`, `movesLeft` at the start of a player's turn.
- Fog of sight, discovery stop, line-of-fire rules: see spec.

### 4. PWA & Mobile Focus
- **Touch Friendly:** Pointer events; tap, drag, pinch.
- **Responsive Canvas:** Handle `window.resize`.
- **Performance:** Redraw on demand; terrain pre-rendered offscreen.

## Roadmap
- [ ] **Phase 1: Local MVP** (Current)
    - [ ] Hex grid, terrain, rendering
    - [ ] Hot-seat 2-16 players, fog of sight
    - [ ] Units: Golfer, Tennis, Hockey, Jogger; facilities produce units
    - [ ] Map editor, map files, bundled maps
    - [ ] PWA manifest & service worker
- [ ] **Phase 2: Expansion**
    - [ ] Building facilities / economy
    - [ ] More units and abilities (Heal, Repair, Buffs, AOE)
- [ ] **Phase 3: Online**
    - [ ] Server relaying actions (WebSocket)
