# Projekt: Sports Battle Isle (MVP)

## Kernkonzept
Ein rundenbasiertes Strategiespiel (TBS) für mobile Endgeräte (PWA), das taktische Tiefe (ähnlich Battle Isle/Polytopia) mit einem Sport-Thema kombiniert. Es nutzt ein duales System aus Aufbau (Sportstätten) und taktischen Kämpfen (Sportler als Einheiten).

## Technische Zielsetzung
- **Plattform:** Progressive Web App (PWA) für iOS und Android.
- **Architektur:** Data-Driven Design (Einheiten-Eigenschaften werden über Config-Files gesteuert).
- **Multiplayer:** 
    - Phase 1: Hot-Seat (lokal am selben Gerät).
    - Phase 2: Online-Multiplayer (via WebSockets/Socket.io).
- **Engine:** HTML5 Canvas / JavaScript.

## Spielmechanik (Combat)
- **Raster:** Quadratisch oder Hexagonal.
- **Einheiten-Attribute:** Name, HP, Attacke, Verteidigung, Bewegung (Move), Reichweite (Range), Symbol.
- **Bewegungs-Logik:** 
    - Standard: `Move` Felder weit laufen.
    - Alternative: Ein Feld gehen, aber Angriff für diesen Zug aussetzen.
- **Spezialfähigkeiten (Abilities):**
    - `HEAL`: Heilt befreundete Einheiten in Reichweite.
    - `REPAIR`: Repariert Ausrüstung/Verteidigung.

## Aktueller Stand (MVP)
- [x] Grundlegendes Grid-System.
- [x] Data-Driven Unit Config.
- [x] Hot-Seat Multiplayer Logik.
- [x] Basis-Kampfsystem (Damage Calculation).
- [x] Implementierung der Heil-Fähigkeit (Physiotherapeut).
