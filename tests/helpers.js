import { TERRAIN_BY_CHAR } from '../src/config.js';
import { key } from '../src/logic/hex.js';

// Build MapData directly from terrain char rows (one string per row r).
export function mapFrom(rows, { roads = [], buildings = {}, specials = {}, starts } = {}) {
  const height = rows.length, width = rows[0].length, tiles = {};
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const k = key(c, r);
    tiles[k] = { terrain: TERRAIN_BY_CHAR[ch], road: roads.includes(k), building: buildings[k] ?? null, special: specials[k] ?? null };
  }));
  starts ??= [
    { at: '0,0', units: ['jogger'], facilities: [] },
    { at: key(width - 1, height - 1), units: ['jogger'], facilities: [] },
  ];
  return { meta: { format: 1, id: 'test', name: 'Test', author: 'test', width, height, players: { min: 2, max: starts.length } }, tiles, starts };
}
