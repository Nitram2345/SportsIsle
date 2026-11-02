// Merging two own units side by side into one stronger unit:
// - canoes: same size -> next size (different unit type, e.g. canoe1 -> canoe2)
// - ranked units: same type and rank -> same type, next rank (Freizeit -> Club -> National -> Profi)
// The partner keeps its id and tile; hp share is kept; the result is locked for the rest of
// this and the whole next own turn (locked, handled in startTurn).
import { UNITS, RANKS, SPECIALS } from '../config.js';
import { distance } from './hex.js';
import { maxHp, bonus } from './vision.js';
import { random } from './rng.js';
import { cargoOf, seats } from './transport.js';

const fresh = u => !u.hasMoved && !u.hasAttacked && !u.attacksUsed && !u.locked && !u.building;
const partners = (state, u, same) => Object.values(state.units)
  .filter(o => o.id !== u.id && o.owner === u.owner && same(o) && fresh(o) && distance(o.at, u.at) === 1)
  .map(o => o.id);
const mine = (state, u) => u && u.owner === state.current && fresh(u);

export function mergeTargets(state, unitId) {
  const u = state.units[unitId];
  if (!mine(state, u) || !UNITS[u.type].mergeInto) return [];
  return partners(state, u, o => o.type === u.type);
}

export function promoteTargets(state, unitId) {
  const u = state.units[unitId];
  if (!mine(state, u) || !UNITS[u.type].ranked || (u.rank ?? 0) >= RANKS.length - 1) return [];
  // carriers: all passengers of both must fit into the promoted unit
  const fits = o => cargoOf(u).length + cargoOf(o).length <= (UNITS[u.type].carry ? seats({ ...o, rank: (o.rank ?? 0) + 1 }) : 0);
  return partners(state, u, o => o.type === u.type && (o.rank ?? 0) === (u.rank ?? 0) && fits(o));
}

function combine(state, unit, other, changes) {
  const share = (unit.hp + other.hp) / (maxHp(unit) + maxHp(other));
  delete state.units[unit.id];
  Object.assign(other, changes, {
    movesLeft: 0, hasMoved: true, hasAttacked: true, locked: 1,
    buffs: [...other.buffs, ...unit.buffs.filter(b => !other.buffs.some(o => o.special === b.special))],
  });
  other.hp = Math.max(1, Math.round(maxHp(other) * share));
}

export function doMerge(state, unit, withId, events) {
  if (!mergeTargets(state, unit.id).includes(withId)) throw new Error('Diese Kanus können nicht zusammengelegt werden.');
  const other = state.units[withId];
  combine(state, unit, other, { type: UNITS[unit.type].mergeInto });
  events.push({ type: 'merged', unitId: unit.id, intoId: withId, from: unit.at, to: other.at, newType: other.type });
}

export function doPromote(state, unit, withId, events) {
  if (!promoteTargets(state, unit.id).includes(withId)) throw new Error('Diese Einheiten können nicht zusammengelegt werden.');
  const other = state.units[withId];
  const cargo = [...cargoOf(other), ...cargoOf(unit)];   // two lifeguards pool their passengers
  combine(state, unit, other, { rank: (other.rank ?? 0) + 1 });
  if (cargo.length) other.cargo = cargo;
  // physio reaching National: roll the power it hands out from now on (seeded, reproducible)
  if (bonus(other, 'gift') && !other.gift) {
    const keys = Object.keys(SPECIALS);
    other.gift = keys[Math.floor(random(state) * keys.length)];
  }
  events.push({ type: 'promoted', unitId: unit.id, intoId: withId, from: unit.at, to: other.at, rank: other.rank, gift: other.gift });
}
