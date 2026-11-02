// Game state and the single entry point for changes: apply(state, action).
import { UNITS, BUILDINGS, SKINS, TERRAIN, RULES } from '../config.js';
import { distance, neighbors } from './hex.js';
import { random } from './rng.js';
import { effective, updateMemory, bonus, maxHp } from './vision.js';
import { doMove, moveCost } from './movement.js';
import { doAttack, doHeal } from './combat.js';
import { doRam } from './ram.js';
import { doBoard, doUnload, cargoOf } from './transport.js';
import { doMerge, doPromote } from './merge.js';

const pick = (state, list) => list[Math.floor(random(state) * list.length)];

export function spawnUnit(state, type, owner, at) {
  const id = 'u' + state.nextId++;
  const skin = {
    variant: pick(state, SKINS.variants),
    tone: Math.floor(random(state) * SKINS.tones.length),
    hair: Math.floor(random(state) * SKINS.hairPerVariant),
  };
  const unit = { id, type, owner, at, rank: 0, hp: UNITS[type].hp, movesLeft: UNITS[type].move, hasMoved: false, hasAttacked: false, skin, buffs: [], building: null };
  state.units[id] = unit;
  return unit;
}

export function createGame(map, players, { seed, startSlots }) {
  // only what would corrupt the state; full playability check is validateMap (UI)
  for (const slot of startSlots) for (const k of map.starts[slot].facilities)
    if (!BUILDINGS[map.tiles[k]?.building]?.capturable) throw new Error(`Startpunkt ${slot + 1}: Feld ${k} ist keine Sportstätte.`);
  const { width, height } = map.meta;
  const state = {
    version: 1, rng: seed | 0, mapId: map.meta.id, width, height,
    tiles: structuredClone(map.tiles),
    players: players.map(p => ({ name: p.name, color: p.color, alive: true })),
    current: 0, round: 1, winner: null,
    units: {}, nextId: 1, facilities: {},
    explored: players.map(() => ({})), lastSeen: players.map(() => ({})),
  };
  for (const [k, t] of Object.entries(state.tiles))
    if (BUILDINGS[t.building]?.capturable) state.facilities[k] = { type: t.building, owner: null, producing: null, progress: 0, needed: 0 };
  startSlots.forEach((slot, pid) => {
    const s = map.starts[slot];
    for (const k of s.facilities) state.facilities[k].owner = pid;
    const free = freeTilesNear(state, s.at, s.units.length);
    s.units.forEach((type, i) => { if (free[i]) spawnUnit(state, type, pid, free[i]); });
  });
  startTurn(state, 0, []);
  return state;
}

// Passable, unoccupied tiles ordered by distance from `at` (start point first).
export function freeTilesNear(state, at, n) {
  const occupied = new Set(Object.values(state.units).map(u => u.at));
  return Object.keys(state.tiles)
    .filter(k => !occupied.has(k) && isPassable(state, k))
    .sort((a, b) => distance(at, a) - distance(at, b) || a.localeCompare(b))
    .slice(0, n);
}

// unit (optional): a swimmer may also stand on water
export const isPassable = (state, k, unit = null) => !!state.tiles[k] && isFinite(moveCost(state.tiles[k], unit));

// ponytail: greedy, not optimal; fine for <=16 starts
export function suggestStarts(map, n, seed) {
  const holder = { rng: seed | 0 }, at = i => map.starts[i].at;
  const chosen = [Math.floor(random(holder) * map.starts.length)];
  while (chosen.length < n) {
    let best = -1, bestD = -1;
    map.starts.forEach((_, i) => {
      if (chosen.includes(i)) return;
      const d = Math.min(...chosen.map(j => distance(at(i), at(j))));
      if (d > bestD) { best = i; bestD = d; }
    });
    chosen.push(best);
  }
  return chosen;
}

export function startTurn(state, pid, events) {
  for (const [at, f] of Object.entries(state.facilities)) if (f.owner === pid) tickProduction(state, at, f, events);
  for (const u of Object.values(state.units)) if (u.owner === pid) {
    const move = effective(u, 'move');
    // dazed (hit since last turn) -> this turn: half move, no attack
    u.dazedNow = !!u.dazed; u.dazed = false;
    u.movesLeft = u.dazedNow ? Math.floor(move / 2) : move;
    u.hasMoved = false; u.hasAttacked = false; u.retreatTo = null; u.attacksUsed = 0; u.treated = [];
    for (const c of cargoOf(u)) { c.justBoarded = false; c.dazed = false; }
    // freshly merged canoe: the whole next own turn it cannot act
    if (u.locked) { u.locked = 0; lockForRoad(u); u.mergeLock = true; } else u.mergeLock = false;
    if (u.building) {
      // road work: one turn of progress; finished -> road on the tile, unit free again
      u.building.left--;
      if (u.building.left <= 0) {
        state.tiles[u.building.at].road = true;
        events.push({ type: 'roadBuilt', unitId: u.id, at: u.building.at });
        u.building = null;
      } else lockForRoad(u);
    }
  }
  updateMemory(state, pid);
}

// Road build time for this jogger on this tile (rank: National -1 on hills/dunes/mountains, Profi -1 everywhere; min 1).
export function roadTurns(unit, tile) {
  const t = TERRAIN[tile.terrain];
  if (!t.roadTurns) return null;
  return Math.max(1, t.roadTurns + (t.height > 0 ? bonus(unit, 'roadHills') : 0) + bonus(unit, 'roadAll'));
}

const lockForRoad = u => { u.movesLeft = 0; u.hasMoved = true; u.hasAttacked = true; };

function doBuildRoad(state, unit) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (!UNITS[unit.type].roadBuild) throw new Error('Nur der Jogger kann Wege anlegen.');
  if (unit.hasMoved || unit.hasAttacked || unit.attacksUsed || unit.building) throw new Error('Einen Weg anlegen geht nur zu Beginn des Zuges.');
  const tile = state.tiles[unit.at], turns = roadTurns(unit, tile);
  if (!turns) throw new Error('Hier kann kein Weg angelegt werden.');
  if (tile.road || tile.building) throw new Error('Hier gibt es schon einen Weg.');
  unit.building = { at: unit.at, left: turns };
  lockForRoad(unit);
}

function doCancelRoad(state, unit) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (!unit.building) throw new Error('Hier wird kein Weg gebaut.');
  unit.building = null;   // progress lost; free again from next turn
}

// carried units count too
const countUnits = (state, pid) => Object.values(state.units).reduce((n, u) => n + (u.owner === pid ? 1 + cargoOf(u).length : 0), 0);

// rank 1 (Club) doubles the base build time; the slowdown for many units comes on top
export function productionTime(state, pid, unitType, rank = 0) {
  const n = countUnits(state, pid);
  if (n >= RULES.unitCap) return null;
  const extra = n < RULES.slowdownFrom ? 0 : Math.floor((n - RULES.slowdownFrom) / RULES.slowdownStep) + 1;
  return UNITS[unitType].build * (rank ? 2 : 1) + extra;
}

// Club units can be produced directly once the player has promoted that unit type once.
export const canProduceRank = (state, pid, unitType, rank) =>
  rank === 0 || (rank === 1 && !!UNITS[unitType]?.ranked && !!state.unlocked?.[pid]?.[unitType]);

function tickProduction(state, at, f, events) {
  if (!f.producing) return;
  if (!f.needed) { f.needed = productionTime(state, f.owner, f.producing, f.rank ?? 0); if (f.needed === null) { f.needed = 0; return; } }
  if (countUnits(state, f.owner) >= RULES.unitCap) return;
  if (f.progress < f.needed) f.progress++;
  if (f.progress < f.needed) return;
  const occupied = new Set(Object.values(state.units).map(u => u.at));
  const spot = [at, ...neighbors(at, state.width, state.height)].find(k => !occupied.has(k) && isPassable(state, k, { type: f.producing }));
  if (!spot) return;  // wait, progress stays
  const u = spawnUnit(state, f.producing, f.owner, spot);
  if (f.rank) { u.rank = f.rank; u.hp = maxHp(u); }   // produced Club unit: full hp, no training lock
  events.push({ type: 'produced', unitId: u.id, at: spot });
  f.progress = 0;
  f.needed = productionTime(state, f.owner, f.producing, f.rank ?? 0) ?? 0;
}

function capture(state, at, pid, events) {
  const f = state.facilities[at];
  if (!f || f.owner === pid) return;
  Object.assign(f, { owner: pid, producing: null, progress: 0, needed: 0, rank: 0 });
  events.push({ type: 'captured', at, player: pid });
  updateMemory(state, pid);
}

function doProduce(state, at, unitType, rank = 0) {
  const f = state.facilities[at];
  if (!f || f.owner !== state.current) throw new Error('Das ist nicht deine Sportstätte.');
  if (unitType === null) { Object.assign(f, { producing: null, progress: 0, needed: 0, rank: 0 }); return; }
  if (!BUILDINGS[f.type].produces.includes(unitType)) throw new Error('Diese Sportstätte stellt das nicht her.');
  if (!canProduceRank(state, f.owner, unitType, rank)) throw new Error('Diese Stufe ist noch nicht freigeschaltet.');
  if (f.producing === unitType && (f.rank ?? 0) === rank) return;
  Object.assign(f, { producing: unitType, rank, progress: 0, needed: productionTime(state, f.owner, unitType, rank) ?? 0 });
}

function endTurn(state, events) {
  const pid = state.current;
  for (const u of Object.values(state.units)) if (u.owner === pid) {
    capture(state, u.at, pid, events);
    u.dazedNow = false;  // the dazed turn is over; a hit taken this turn stays pending in u.dazed
    for (const b of u.buffs) if (b.fresh) b.fresh = false; else b.turns--;
    u.buffs = u.buffs.filter(b => b.turns > 0);
  }
  checkElimination(state, events);
  if (state.winner !== null || !state.players.some(p => p.alive)) return;
  let next = pid;
  do {
    next = (next + 1) % state.players.length;
    if (next === 0) state.round++;
  } while (!state.players[next].alive);
  state.current = next;
  startTurn(state, next, events);
}

const getUnit = (s, id) => s.units[id] ?? (() => { throw new Error('Einheit nicht gefunden.'); })();

export function apply(state, action) {
  if (state.winner !== null) throw new Error('Das Spiel ist vorbei.');
  const s = structuredClone(state), events = [];
  switch (action?.type) {
    case 'move': {
      const u = getUnit(s, action.unitId);
      doMove(s, u, action.path, events);
      capture(s, u.at, u.owner, events);
      break;
    }
    case 'produce': doProduce(s, action.at, action.unitType, action.rank ?? 0); break;
    case 'endTurn': endTurn(s, events); break;
    case 'attack': doAttack(s, getUnit(s, action.unitId), action.targetId, events); break;
    case 'heal': doHeal(s, getUnit(s, action.unitId), action.targetId, events); break;
    case 'buildRoad': doBuildRoad(s, getUnit(s, action.unitId)); break;
    case 'cancelRoad': doCancelRoad(s, getUnit(s, action.unitId)); break;
    case 'board': doBoard(s, getUnit(s, action.unitId), action.carrierId, events); break;
    case 'merge': doMerge(s, getUnit(s, action.unitId), action.withId, events); break;
    case 'promote': doPromote(s, getUnit(s, action.unitId), action.withId, events); break;
    case 'unload': {
      const c = getUnit(s, action.unitId);
      doUnload(s, c, action.to, events);
      capture(s, action.to, c.owner, events);
      break;
    }
    case 'ram': {
      const u = getUnit(s, action.unitId);
      doRam(s, u, action.path, events);
      if (s.units[u.id]) capture(s, u.at, u.owner, events);
      break;
    }
    default: throw new Error(`Unbekannte Aktion: ${action?.type}`);
  }
  checkElimination(s, events);
  return { state: s, events };
}

export function checkElimination(state, events) {
  state.players.forEach((p, pid) => {
    if (!p.alive) return;
    const hasUnit = Object.values(state.units).some(u => u.owner === pid);
    const hasFacility = Object.values(state.facilities).some(f => f.owner === pid);
    if (!hasUnit && !hasFacility) { p.alive = false; events.push({ type: 'eliminated', player: pid }); }
  });
  const alive = state.players.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
  if (alive.length === 1 && state.winner === null) { state.winner = alive[0]; events.push({ type: 'won', player: alive[0] }); }
}

// Own units of the current player that have neither moved nor attacked yet ("next unit").
export const idleUnits = state => Object.values(state.units)
  .filter(u => u.owner === state.current && !u.hasMoved && !u.hasAttacked && !u.attacksUsed)
  .map(u => u.id);
