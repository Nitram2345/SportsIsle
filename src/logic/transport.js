// Transport (lifeguard): own units board a neighbouring carrier and leave the map;
// they ride along and step off one tile in a later turn. Seats: UNITS.carry + rank bonus.
import { UNITS } from '../config.js';
import { neighbors, distance } from './hex.js';
import { moveCost } from './movement.js';
import { bonus } from './vision.js';

// cargo is a list; older saves stored a single unit or null
export const cargoOf = c => !c?.cargo ? [] : Array.isArray(c.cargo) ? c.cargo : [c.cargo];
export const seats = c => (UNITS[c.type].carry ?? 0) + bonus(c, 'carry');

const canStand = (state, k, unit) => !!state.tiles[k] && isFinite(moveCost(state.tiles[k], unit))
  && !Object.values(state.units).some(u => u.at === k);

// Carriers the unit could board right now.
export function boardTargets(state, unitId) {
  const u = state.units[unitId];
  if (!u || u.owner !== state.current || UNITS[u.type].carry || u.hasMoved || u.hasAttacked || u.attacksUsed || u.building) return [];
  return Object.values(state.units)
    .filter(c => c.owner === u.owner && UNITS[c.type].carry && cargoOf(c).length < seats(c) && distance(c.at, u.at) === 1)
    .map(c => c.id);
}

export function doBoard(state, unit, carrierId, events) {
  if (!boardTargets(state, unit.id).includes(carrierId)) throw new Error('Hier kann diese Einheit nicht aufsteigen.');
  const carrier = state.units[carrierId];
  delete state.units[unit.id];
  carrier.cargo = [...cargoOf(carrier), { ...unit, at: carrier.at, hasMoved: true, movesLeft: 0, justBoarded: true }];
  events.push({ type: 'boarded', unitId: unit.id, carrierId, from: unit.at });
}

// The first passenger that may step off this turn (not the one that just boarded).
const ready = (c, cargoId) => cargoOf(c).find(u => !u.justBoarded && (!cargoId || u.id === cargoId));

// Tiles the next ready passenger could step onto.
export function unloadTargets(state, carrierId, cargoId) {
  const c = state.units[carrierId], u = ready(c, cargoId);
  if (!u || c.owner !== state.current) return [];
  return neighbors(c.at, state.width, state.height).filter(k => canStand(state, k, u));
}

export function doUnload(state, carrier, to, events, cargoId) {
  const u = ready(carrier, cargoId);
  if (!u) throw new Error('Aussteigen geht erst im nächsten Zug.');
  if (!unloadTargets(state, carrier.id, u.id).includes(to)) throw new Error('Dort kann die Einheit nicht aussteigen.');
  carrier.cargo = cargoOf(carrier).filter(x => x.id !== u.id);
  state.units[u.id] = { ...u, at: to, hasMoved: true, movesLeft: 0, justBoarded: false };
  events.push({ type: 'unloaded', unitId: u.id, carrierId: carrier.id, from: carrier.at, to });
}

// Carrier knocked out: in deep water the passengers drown; in shallow water or on land
// they survive on its tile (a second passenger takes a free neighbour tile, else drowns).
export function dropCargo(state, carrier, events) {
  for (const u of cargoOf(carrier)) {
    const survivable = isFinite(moveCost(state.tiles[carrier.at], u));
    const spot = survivable && [carrier.at, ...neighbors(carrier.at, state.width, state.height)].find(k => canStand(state, k, u));
    if (spot) { state.units[u.id] = { ...u, at: spot, justBoarded: false }; events.push({ type: 'rescued', unitId: u.id, at: spot }); }
    else events.push({ type: 'drowned', unitId: u.id });
  }
}
