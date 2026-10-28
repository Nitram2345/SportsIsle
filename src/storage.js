// localStorage wrapper. Every access may throw (private mode, quota) -> game runs without saving.
const SAVE = 'sbi.save', MAPS = 'sbi.maps';

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const saveGame = state => write(SAVE, state);
export const loadGame = () => read(SAVE, null);
export const clearGame = () => { try { localStorage.removeItem(SAVE); } catch { /* ignore */ } };

// Local maps are stored in file format, keyed by id.
export const listLocalMaps = () => Object.values(read(MAPS, {}));
export function saveLocalMap(json) { const all = read(MAPS, {}); all[json.id] = json; return write(MAPS, all); }
export function deleteLocalMap(id) { const all = read(MAPS, {}); delete all[id]; write(MAPS, all); }
