// Transport (lifeguard): an own unit boards a neighbouring carrier and leaves the map;
// it rides along and steps off one tile in a later turn.
import { UNITS } from '../config.js';
import { neighbors, distance } from './hex.js';
import { moveCost } from './movement.js';

const canStand = (state, k, unit) => !!state.tiles[k] && isFinite(moveCost(state.tiles[k], unit))
  && !Object.values(state.units).some(u => u.at === k);

// Carriers the unit could board right now.
export function boardTargets(state, unitId) {
  const u = state.units[unitId];
  if (!u || u.owner !== state.current || UNITS[u.type].carry || u.hasMoved || u.hasAttacked || u.attacksUsed || u.building) return [];
  return Object.values(state.units)
    .filter(c => c.owner === u.owner && UNITS[c.type].carry && !c.cargo && distance(c.at, u.at) === 1)
    .map(c => c.id);
}

export function doBoard(state, unit, carrierId, events) {
  if (!boardTargets(state, unit.id).includes(carrierId)) throw new Error('Hier kann diese Einheit nicht aufsteigen.');
  const carrier = state.units[carrierId];
  delete state.units[unit.id];
  carrier.cargo = { ...unit, at: carrier.at, hasMoved: true, movesLeft: 0, justBoarded: true };
  events.push({ type: 'boarded', unitId: unit.id, carrierId, from: unit.at });
}

// Tiles the cargo could step onto (not in the boarding turn).
export function unloadTargets(state, carrierId) {
  const c = state.units[carrierId];
  if (!c?.cargo || c.owner !== state.current || c.cargo.justBoarded) return [];
  return neighbors(c.at, state.width, state.height).filter(k => canStand(state, k, c.cargo));
}

export function doUnload(state, carrier, to, events) {
  if (carrier.cargo?.justBoarded) throw new Error('Aussteigen geht erst im nächsten Zug.');
  if (!unloadTargets(state, carrier.id).includes(to)) throw new Error('Dort kann die Einheit nicht aussteigen.');
  const u = carrier.cargo;
  carrier.cargo = null;
  state.units[u.id] = { ...u, at: to, hasMoved: true, movesLeft: 0, justBoarded: false };
  events.push({ type: 'unloaded', unitId: u.id, carrierId: carrier.id, from: carrier.at, to });
}

// Carrier knocked out: cargo survives on its tile if it could stand there, else drowns.
export function dropCargo(state, carrier, events) {
  const u = carrier.cargo;
  if (!u) return;
  if (canStand(state, carrier.at, u)) { state.units[u.id] = { ...u, at: carrier.at, justBoarded: false }; events.push({ type: 'rescued', unitId: u.id, at: carrier.at }); }
  else events.push({ type: 'drowned', unitId: u.id });
}
