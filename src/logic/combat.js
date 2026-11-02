// Combat: range, line of fire, damage.
import { UNITS, TERRAIN, BUILDINGS, SPECIALS } from '../config.js';
import { distance, lineBetween, extend } from './hex.js';
import { visibleUnits, effective, maxHp, bonus } from './vision.js';
import { dropCargo } from './transport.js';

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
  if (UNITS[unit.type].whistle) {
    // whistle: no damage, target is dazed for its next turn; a Profi lifeguard's whistle
    // also hurts an adjacent target (1 damage – it hurts the ears)
    target.dazed = true;
    events.push({ type: 'whistle', unitId: unit.id, targetId });
    const hurt = bonus(unit, 'hurtAdjacent');
    if (hurt && distance(unit.at, target.at) === 1) wound(state, target, hurt, events);
    return;
  }
  const behind = UNITS[unit.type].splash ? extend(unit.at, target.at) : null;
  hit(state, unit, target, events);
  counterStrike(state, unit, target, events);
  // shot put: the enemy right behind the target (straight line) takes a share of the attack
  if (behind && state.units[unit.id]) {
    const back = Object.values(state.units).find(u => u.at === behind && u.owner !== unit.owner);
    if (back) {
      const atk = Math.floor(effective(unit, 'atk') * UNITS[unit.type].splash);
      const amount = Math.max(1, atk - (effective(back, 'def') + TERRAIN[state.tiles[back.at].terrain].def));
      events.push({ type: 'splash', unitId: unit.id, targetId: back.id });
      wound(state, back, amount, events);
    }
  }
}

// Physio: own units on neighbouring tiles that are hurt or dazed, not treated this turn.
// Treatments per turn: 1 (+1 as Profi); from National on, patients also get its gift buff.
export function healTargets(state, unitId) {
  const unit = state.units[unitId];
  if (!UNITS[unit.type].heal || unit.hasMoved || unit.hasAttacked) return [];
  return Object.values(state.units)
    .filter(t => t.owner === unit.owner && t.id !== unit.id && distance(unit.at, t.at) === 1
      && !(unit.treated ?? []).includes(t.id)
      && (t.hp < maxHp(t) || t.dazed || t.dazedNow))
    .map(t => t.id);
}

export function doHeal(state, unit, targetId, events) {
  if (unit.owner !== state.current) throw new Error('Diese Einheit gehört nicht dir.');
  if (!UNITS[unit.type].heal) throw new Error('Diese Einheit kann nicht behandeln.');
  if (unit.hasMoved || unit.hasAttacked) throw new Error('Behandeln geht nur einmal pro Zug und nicht nach dem Ziehen.');
  if (!healTargets(state, unit.id).includes(targetId)) throw new Error('Diese Einheit kann hier nicht behandelt werden.');
  const t = state.units[targetId], before = t.hp;
  t.hp = Math.min(maxHp(t), t.hp + UNITS[unit.type].heal + bonus(unit, 'heal'));
  t.dazed = false; t.dazedNow = false;
  events.push({ type: 'healed', unitId: targetId, amount: t.hp - before });
  if (unit.gift && bonus(unit, 'gift')) {
    const sp = SPECIALS[unit.gift];
    t.buffs = t.buffs.filter(b => b.special !== unit.gift);
    t.buffs.push({ special: unit.gift, stat: sp.stat, amount: sp.amount, turns: sp.turns, fresh: true });
    events.push({ type: 'buff', unitId: targetId, special: unit.gift });
  }
  unit.treated = [...(unit.treated ?? []), targetId];
  unit.movesLeft = 0;
  if (unit.treated.length >= 1 + bonus(unit, 'treats')) unit.hasAttacked = true;
  else unit.attacksUsed = (unit.attacksUsed ?? 0) + 1;   // started treating: no more moving
}

// Active defence: survivor with counter strikes back at an adjacent attacker (free, once).
export function counterStrike(state, attacker, target, events) {
  if (state.units[target.id] && state.units[attacker.id] && UNITS[target.type].counter && distance(attacker.at, target.at) === 1) {
    events.push({ type: 'counter', unitId: target.id, targetId: attacker.id });
    hit(state, target, attacker, events);
  }
}

export function hit(state, attacker, target, events) {
  wound(state, target, damage(state, attacker, target), events);
}

// Apply damage: event, knock-out (drops cargo), soccer daze.
function wound(state, target, amount, events) {
  target.hp -= amount;
  events.push({ type: 'damage', targetId: target.id, amount });
  if (target.hp <= 0) { delete state.units[target.id]; events.push({ type: 'killed', unitId: target.id }); dropCargo(state, target, events); return; }
  if (UNITS[target.type].dazeOnHit) target.dazed = true;
}
