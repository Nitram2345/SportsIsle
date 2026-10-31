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
  if (range > 0 && downhill(state, unit, targetAt)) range += 1;
  return range;
}

function tileBlocks(state, blockedBy, k) {
  const tile = state.tiles[k];
  if (!tile) return false;
  if (TERRAIN[tile.terrain].flags.some(f => blockedBy.includes(f))) return true;
  return blockedBy.includes('building') && !!BUILDINGS[tile.building]?.blocks;
}

// climb units attacking from a higher level than the target
const height = (state, k) => TERRAIN[state.tiles[k]?.terrain]?.height ?? 0;
const downhill = (state, unit, targetAt) => !!UNITS[unit.type].climb && height(state, unit.at) > height(state, targetAt);

// A step blocks only if all its hexes block (line along an edge).
export function pathBlocked(state, unit, targetAt) {
  const { blockedBy } = UNITS[unit.type];
  if (UNITS[unit.type].climb && height(state, unit.at) === 2) return false;   // from a summit nothing blocks
  return lineBetween(unit.at, targetAt).some(step => step.every(k => tileBlocks(state, blockedBy, k)));
}

export const damage = (state, attacker, target) =>
  Math.max(1, effective(attacker, 'atk') + (downhill(state, attacker, target.at) ? 1 : 0) - (effective(target, 'def') + TERRAIN[state.tiles[target.at].terrain].def));

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
  // attacks per turn (table tennis: 2); moving is over after the first one
  unit.attacksUsed = (unit.attacksUsed ?? 0) + 1;
  unit.movesLeft = 0;
  if (unit.attacksUsed >= (UNITS[unit.type].attacks ?? 1)) unit.hasAttacked = true;
  hit(state, unit, target, events);
  counterStrike(state, unit, target, events);
}

// Physio: own units on neighbouring tiles that are hurt or dazed.
export function healTargets(state, unitId) {
  const unit = state.units[unitId];
  if (!UNITS[unit.type].heal || unit.hasMoved || unit.hasAttacked) return [];
  return Object.values(state.units)
    .filter(t => t.owner === unit.owner && t.id !== unit.id && distance(unit.at, t.at) === 1
      && (t.hp < UNITS[t.type].hp || t.dazed || t.dazedNow))
    .map(t => t.id);
}

export function doHeal(state, unit, targetId, events) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (!UNITS[unit.type].heal) throw new Error('Diese Einheit kann nicht behandeln.');
  if (unit.hasMoved || unit.hasAttacked) throw new Error('Behandeln geht nur einmal pro Zug und nicht nach dem Ziehen.');
  if (!healTargets(state, unit.id).includes(targetId)) throw new Error('Diese Einheit kann hier nicht behandelt werden.');
  const t = state.units[targetId], before = t.hp;
  t.hp = Math.min(UNITS[t.type].hp, t.hp + UNITS[unit.type].heal);
  t.dazed = false; t.dazedNow = false;
  unit.hasAttacked = true; unit.movesLeft = 0;
  events.push({ type: 'healed', unitId: targetId, amount: t.hp - before });
}

// Active defence: survivor with counter strikes back at an adjacent attacker (free, once).
export function counterStrike(state, attacker, target, events) {
  if (state.units[target.id] && state.units[attacker.id] && UNITS[target.type].counter && distance(attacker.at, target.at) === 1) {
    events.push({ type: 'counter', unitId: target.id, targetId: attacker.id });
    hit(state, target, attacker, events);
  }
}

export function hit(state, attacker, target, events) {
  const amount = damage(state, attacker, target);
  target.hp -= amount;
  events.push({ type: 'damage', targetId: target.id, amount });
  if (target.hp <= 0) { delete state.units[target.id]; events.push({ type: 'killed', unitId: target.id }); return; }
  if (UNITS[target.type].dazeOnHit) target.dazed = true;
}
