// Canoes: two own canoes of the same size side by side merge into the next size.
import { UNITS } from '../config.js';
import { distance } from './hex.js';

const fresh = u => !u.hasMoved && !u.hasAttacked && !u.attacksUsed && !u.locked;

export function mergeTargets(state, unitId) {
  const u = state.units[unitId];
  if (!u || u.owner !== state.current || !UNITS[u.type].mergeInto || !fresh(u)) return [];
  return Object.values(state.units)
    .filter(o => o.id !== u.id && o.owner === u.owner && o.type === u.type && fresh(o) && distance(o.at, u.at) === 1)
    .map(o => o.id);
}

// The partner keeps its id and tile and becomes the bigger canoe; hp share is kept.
// The new canoe is locked for its next own turn (lockedTurns, counted in startTurn).
export function doMerge(state, unit, withId, events) {
  if (!mergeTargets(state, unit.id).includes(withId)) throw new Error('Diese Kanus können nicht zusammengelegt werden.');
  const other = state.units[withId], from = UNITS[unit.type], to = UNITS[from.mergeInto];
  const share = (unit.hp + other.hp) / (2 * from.hp);
  delete state.units[unit.id];
  Object.assign(other, {
    type: from.mergeInto, hp: Math.max(1, Math.round(to.hp * share)),
    movesLeft: 0, hasMoved: true, hasAttacked: true, locked: 1,
    buffs: [...other.buffs, ...unit.buffs.filter(b => !other.buffs.some(o => o.special === b.special))],
  });
  events.push({ type: 'merged', unitId: unit.id, intoId: withId, from: unit.at, to: other.at, newType: other.type });
}
