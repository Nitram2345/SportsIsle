// Ram (rugby): charge along a path into a visible enemy, push it one tile on, take its place.
import { UNITS, SPECIALS } from '../config.js';
import { neighbors, extend } from './hex.js';
import { reachable } from './movement.js';
import { visibleUnits, updateMemory } from './vision.js';
import { hit, counterStrike } from './combat.js';
import { isPassable } from './game.js';

// Target id -> full path (run-up + target tile). Run-up = at least 1 tile before the
// target tile, i.e. the rugby player covers >= 2 tiles. Only the run-up costs move
// points (it is a reachable path); the target tile is entered by the push itself.
export function ramTargets(state, unitId) {
  const unit = state.units[unitId], out = {};
  if (!UNITS[unit.type].ram || unit.hasMoved || unit.hasAttacked || unit.dazedNow) return out;
  const reach = reachable(state, unitId);
  const enemies = visibleUnits(state, unit.owner).filter(u => u.owner !== unit.owner);
  for (const e of enemies) {
    let best = null;
    for (const n of neighbors(e.at, state.width, state.height)) {
      const run = reach[n];
      if (!run) continue;   // also excludes standing next to it (no run-up)
      if (!best || run.length < best.length - 1) best = [...run, e.at];
    }
    if (best) out[e.id] = best;
  }
  return out;
}

export function doRam(state, unit, path, events) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (!UNITS[unit.type].ram) throw new Error('Diese Einheit kann nicht rammen.');
  if (unit.hasMoved || unit.hasAttacked) throw new Error('Rammen geht nur als ganzer Zug, ohne vorher zu ziehen.');
  if (unit.dazedNow) throw new Error('Diese Einheit ist angeschlagen und kann diese Runde nicht angreifen.');
  if (!Array.isArray(path) || path.length < 2) throw new Error('Zum Rammen braucht es mindestens 2 Felder Anlauf.');
  const targetAt = path[path.length - 1];
  const target = visibleUnits(state, unit.owner).find(u => u.at === targetAt && u.owner !== unit.owner);
  if (!target) throw new Error('Am Ende des Weges steht kein sichtbarer Gegner.');
  const run = path.slice(0, -1);
  const legal = reachable(state, unit.id)[run[run.length - 1]];
  if (!legal || legal.join() !== run.join()) throw new Error('Ungültiger Anlauf.');

  // run-up (no discovery stop: the charge is committed)
  for (const k of run) {
    unit.at = k;
    const sp = SPECIALS[state.tiles[k].special];
    if (sp) {
      unit.buffs = unit.buffs.filter(b => b.special !== state.tiles[k].special);
      unit.buffs.push({ special: state.tiles[k].special, stat: sp.stat, amount: sp.amount, turns: sp.turns, fresh: true });
      events.push({ type: 'buff', unitId: unit.id, special: state.tiles[k].special });
    }
  }
  updateMemory(state, unit.owner);
  unit.hasMoved = true; unit.hasAttacked = true; unit.movesLeft = 0;
  events.push({ type: 'ram', unitId: unit.id, targetId: target.id });

  const behind = extend(unit.at, targetAt);
  const occupied = new Set(Object.values(state.units).map(u => u.at));
  const canGiveWay = !!state.tiles[behind] && isPassable(state, behind) && !occupied.has(behind);

  hit(state, unit, target, events);
  if (!state.units[target.id]) { unit.at = targetAt; }          // knocked out: take the tile
  else if (canGiveWay) {
    target.at = behind; unit.at = targetAt;
    events.push({ type: 'pushed', unitId: target.id, to: behind });
  } else events.push({ type: 'blocked', unitId: unit.id });
  updateMemory(state, unit.owner);
  counterStrike(state, unit, target, events);
}

