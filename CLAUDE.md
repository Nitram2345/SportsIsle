# Claude Code Project Guidelines - Sports Battle Isle

## Project Overview
A data-driven, turn-based strategy game (TBS) for mobile (PWA) combining city-builder elements (sports facilities) with tactical combat (sports units).

## Tech Stack
- **Frontend:** HTML5 Canvas, JavaScript (Vanilla/ES6+), CSS3.
- **Target:** Progressive Web App (PWA).
- **Architecture:** Data-driven (Units/Buildings defined in JSON configs).
- **Multiplayer Pattern:** Hot-seat (current) $\rightarrow$ WebSocket (future).

## Development Standards

### 1. Data-Driven Design
- **DO NOT** hardcode unit stats in logic.
- **ALWAYS** use `UNIT_CONFIGS` or similar JSON structures for all gameplay parameters (HP, ATK, DEF, MOVE, RANGE, etc.).
- New units or abilities must be added by extending configuration objects.

### 2. Code Structure
- **Logic/View Separation:** Keep game state management (grid, units, turns) separate from the Canvas rendering loop.
- **Ability System:** Implement abilities via a command pattern or a dedicated `AbilityHandler` to ensure scalability (e.g., `HEAL`, `REPAIR`, `BUFF`).
- **Single File MVP:** For the current prototype, keep the logic in a single manageable file, but prepare for module separation (ES Modules) as complexity grows.

### 3. Gameplay Rules (The "Battle Isle" Feel)
- **Movement vs. Attack:** Moving consumes the ability to attack in the same turn (unless specified otherwise).
- **Combat Calculation:** `damage = max(1, attacker.attack - defender.defense)`.
- **Turn Management:** Clear state resets (reset `hasMoved`, `hasAttacked`) when switching players.

### 4. PWA & Mobile Focus
- **Touch Friendly:** Ensure interaction handlers (`mousedown`/`touchstart`) account for mobile input.
- **Responsive Canvas:** Handle `window.resize` to maintain the grid aspect ratio.
- **Performance:** Keep the render loop efficient to ensure smooth 60fps on mobile browsers.

## Roadmap
- [ ] **Phase 1: Local MVP** (Current)
    - [x] Grid & Unit Rendering
    - [x] Hot-seat Multiplayer
    - [x] Ability: Heal
- [ ] **Phase 2: Expansion**
    - [ ] Add Building/Management Layer (Economy)
    - [ ] Implement more abilities (Repair, Buffs, AOE)
    - [ ] Hexagonal Grid Transition
- [ ] **Phase 3: Online**
    - [ ] WebSocket Integration (Node.js Backend)
    - [ ] PWA Manifest & Service Worker
