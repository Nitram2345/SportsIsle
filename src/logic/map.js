// Map data: runtime format (keyed tiles) <-> file format (JSON, terrain as char rows).
import { TERRAIN, TERRAIN_BY_CHAR, BUILDINGS, SPECIALS, UNITS } from '../config.js';
import { key, parseKey, neighbors } from './hex.js';

export const FORMAT = 1;

export function createEmptyMap({ id, name, author = '', width, height }) {
  const tiles = {};
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) tiles[key(c, r)] = { terrain: 'grass', road: false, building: null, special: null };
  return { meta: { format: FORMAT, id, name, author, width, height, players: { min: 2, max: 2 } }, tiles, starts: [] };
}

export const canPlace = (tile, buildingId) => !!TERRAIN[tile.terrain]?.buildable && !!BUILDINGS[buildingId];

const pos = ([c, r]) => key(c, r);

// Structural check of a file object. Returns error messages.
function validateFile(f) {
  if (!f || typeof f !== 'object') return ['Keine gültige Map-Datei.'];
  if (f.format !== FORMAT) return [`Unbekanntes Map-Format: ${f.format} (erwartet ${FORMAT}).`];
  const errs = [];
  const { width, height } = f;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return ['Breite/Höhe fehlen oder sind ungültig.'];
  if (!Array.isArray(f.terrain) || f.terrain.length !== height) return [`Gelände muss ${height} Zeilen haben.`];
  f.terrain.forEach((row, r) => {
    if (typeof row !== 'string' || row.length !== width) errs.push(`Zeile ${r}: Länge muss ${width} sein.`);
    else [...row].forEach((ch, c) => { if (!TERRAIN_BY_CHAR[ch]) errs.push(`Feld ${c},${r}: unbekanntes Gelände "${ch}".`); });
  });
  const inMap = at => Array.isArray(at) && at.length === 2 && Number.isInteger(at[0]) && Number.isInteger(at[1])
    && at[0] >= 0 && at[1] >= 0 && at[0] < width && at[1] < height;
  for (const name of ['roads', 'buildings', 'specials']) if (f[name] !== undefined && !Array.isArray(f[name])) errs.push(`${name} muss eine Liste sein.`);
  if (errs.length) return errs;
  for (const at of f.roads ?? []) if (!inMap(at)) errs.push(`Straße außerhalb der Karte: ${JSON.stringify(at)}.`);
  for (const x of f.buildings ?? []) {
    if (!inMap(x?.at)) errs.push(`Bebauung außerhalb der Karte: ${JSON.stringify(x?.at)}.`);
    if (!BUILDINGS[x?.type]) errs.push(`Unbekannte Bebauung "${x?.type}".`);
  }
  for (const x of f.specials ?? []) {
    if (!inMap(x?.at)) errs.push(`Sonderfeld außerhalb der Karte: ${JSON.stringify(x?.at)}.`);
    if (!SPECIALS[x?.type]) errs.push(`Unbekanntes Sonderfeld "${x?.type}".`);
  }
  if (!Array.isArray(f.starts)) errs.push('Startpunkte fehlen.');
  else for (const s of f.starts) {
    if (!Array.isArray(s?.units ?? []) || !Array.isArray(s?.facilities ?? [])) { errs.push('Startpunkt: units/facilities müssen Listen sein.'); continue; }
    if (!inMap(s?.at)) errs.push(`Startpunkt außerhalb der Karte: ${JSON.stringify(s?.at)}.`);
    for (const u of s?.units ?? []) if (!UNITS[u]) errs.push(`Unbekannte Einheit "${u}".`);
    for (const at of s?.facilities ?? []) if (!inMap(at)) errs.push(`Start-Sportstätte außerhalb der Karte: ${JSON.stringify(at)}.`);
  }
  return errs;
}

export function loadMap(f) {
  const errs = validateFile(f);
  if (errs.length) throw new Error(errs.join('\n'));
  const m = createEmptyMap({ id: f.id ?? 'map', name: f.name ?? 'Unbenannt', author: f.author ?? '', width: f.width, height: f.height });
  f.terrain.forEach((row, r) => [...row].forEach((ch, c) => { m.tiles[key(c, r)].terrain = TERRAIN_BY_CHAR[ch]; }));
  for (const at of f.roads ?? []) m.tiles[pos(at)].road = true;
  for (const x of f.buildings ?? []) m.tiles[pos(x.at)].building = x.type;
  for (const x of f.specials ?? []) m.tiles[pos(x.at)].special = x.type;
  m.starts = f.starts.map(s => ({ at: pos(s.at), units: [...(s.units ?? [])], facilities: (s.facilities ?? []).map(pos) }));
  m.meta.players = { min: f.players?.min ?? 2, max: m.starts.length };
  return m;
}

export function saveMap(m) {
  const { width, height } = m.meta, terrain = [], roads = [], buildings = [], specials = [];
  for (let r = 0; r < height; r++) {
    let row = '';
    for (let c = 0; c < width; c++) {
      const t = m.tiles[key(c, r)];
      row += TERRAIN[t.terrain].char;
      if (t.road) roads.push([c, r]);
      if (t.building) buildings.push({ at: [c, r], type: t.building });
      if (t.special) specials.push({ at: [c, r], type: t.special });
    }
    terrain.push(row);
  }
  return {
    format: FORMAT, id: m.meta.id, name: m.meta.name, author: m.meta.author, width, height,
    players: { min: m.meta.players.min, max: m.starts.length },
    terrain, roads, buildings, specials,
    starts: m.starts.map(s => ({ at: parseKey(s.at), units: [...s.units], facilities: s.facilities.map(parseKey) })),
  };
}

// Playability check (editor export, bundled maps).
export function validateMap(m) {
  const errs = [];
  if (m.starts.length < 2) errs.push('Mindestens 2 Startpunkte nötig.');
  m.starts.forEach((s, i) => {
    if (!TERRAIN[m.tiles[s.at]?.terrain]?.passable) errs.push(`Startpunkt ${i + 1} muss auf begehbarem Gelände liegen.`);
    if (!s.units.length && !s.facilities.length) errs.push(`Startpunkt ${i + 1} braucht mindestens eine Einheit oder Sportstätte.`);
    for (const u of s.units) if (!UNITS[u]) errs.push(`Startpunkt ${i + 1}: unbekannte Einheit "${u}".`);
    for (const k of s.facilities) {
      const b = BUILDINGS[m.tiles[k]?.building];
      if (!b?.capturable) errs.push(`Startpunkt ${i + 1}: Feld ${k} ist keine Sportstätte.`);
    }
  });
  for (const [k, t] of Object.entries(m.tiles))
    if (t.building && !canPlace(t, t.building)) errs.push(`Feld ${k}: ${BUILDINGS[t.building]?.name ?? t.building} ist auf ${TERRAIN[t.terrain].name} nicht erlaubt.`);
  return errs;
}

// id not in taken; appends -2, -3, ...
export function uniqueMapId(id, taken) {
  if (!taken.includes(id)) return id;
  let n = 2;
  while (taken.includes(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

// Shallow water rings every land tile: sea/lake next to land becomes shallow,
// shallow without land next to it turns back into sea. Rivers stay rivers.
export function applyShallows(m) {
  const { width, height } = m.meta;
  const land = k => !TERRAIN[m.tiles[k].terrain].flags.includes('water');
  const nearLand = k => neighbors(k, width, height).some(land);
  for (const [k, t] of Object.entries(m.tiles)) {
    if ((t.terrain === 'sea' || t.terrain === 'lake') && nearLand(k)) t.terrain = 'shallow';
    else if (t.terrain === 'shallow' && !nearLand(k)) t.terrain = 'sea';
  }
  return m;
}
