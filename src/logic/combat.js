// Combat: range, line of fire, damage.
import { UNITS, TERRAIN, BUILDINGS } from '../config.js';
import { distance, lineBetween } from './hex.js';
import { visibleUnits, effective } from './vision.js';

export function attackRange(state, unit, targetAt) {
  const cfg = UNITS[unit.type];
  let range = effective(unit, 'range');
  const own = TERRAIN[state.tiles[unit.at].terrain];
  if (cfg.rangeOnFlag && own.flags.includes(cfg.rangeOnFlag.flag)) range = cfg.rangeOnFlag.range;
  if (range > 0 && state.tiles[targetAt]?.road) range += cfg.roadBonus;
  return range;
}

function tileBlocks(state, blockedBy, k) {
  const tile = state.tiles[k];
  if (!tile) return false;
  if (TERRAIN[tile.terrain].flags.some(f => blockedBy.includes(f))) return true;
  return blockedBy.includes('building') && !!BUILDINGS[tile.building]?.blocks;
}

// A step blocks only if all its hexes block (line along an edge).
export function pathBlocked(state, unit, targetAt) {
  const { blockedBy } = UNITS[unit.type];
  return lineBetween(unit.at, targetAt).some(step => step.every(k => tileBlocks(state, blockedBy, k)));
}

export const damage = (state, attacker, target) =>
  Math.max(1, effective(attacker, 'atk') - (effective(target, 'def') + TERRAIN[state.tiles[target.at].terrain].def));

export function attackTargets(state, unitId) {
  const unit = state.units[unitId];
  if (!UNITS[unit.type].range || unit.dazedNow) return [];
  return visibleUnits(state, unit.owner)
    .filter(t => t.owner !== unit.owner
      && distance(unit.at, t.at) <= attackRange(state, unit, t.at)
      && !pathBlocked(state, unit, t.at))
    .map(t => t.id);
}

export function doAttack(state, unit, targetId, events) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (unit.dazedNow) throw new Error('Diese Einheit ist angeschlagen und kann diese Runde nicht angreifen.');
  if (unit.hasMoved) throw new Error('Wer sich bewegt hat, kann nicht mehr schlagen.');
  if (unit.hasAttacked) throw new Error('Diese Einheit hat schon geschlagen.');
  if (!attackTargets(state, unit.id).includes(targetId)) throw new Error('Ziel nicht erreichbar.');
  const target = state.units[targetId];
  unit.hasAttacked = true; unit.movesLeft = 0;
  hit(state, unit, target, events);
  // Active defence: survivor with counter strikes back at an adjacent attacker (free, once).
  if (state.units[targetId] && UNITS[target.type].counter && distance(unit.at, target.at) === 1) {
    events.push({ type: 'counter', unitId: targetId, targetId: unit.id });
    hit(state, target, unit, events);
  }
}

function hit(state, attacker, target, events) {
  const amount = damage(state, attacker, target);
  target.hp -= amount;
  events.push({ type: 'damage', targetId: target.id, amount });
  if (target.hp <= 0) { delete state.units[target.id]; events.push({ type: 'killed', unitId: target.id }); return; }
  if (UNITS[target.type].dazeOnHit) target.dazed = true;
}
