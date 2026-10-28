// Provisional (Task 8): test map with all terrain + all unit variants.
import { createEmptyMap } from './logic/map.js';
import { createGame, spawnUnit } from './logic/game.js';
import { TERRAIN, PLAYER_COLORS } from './config.js';
import { createRenderer } from './render/renderer.js';
import { createCamera, zoomAt } from './render/camera.js';
import { preloadSvgs } from './render/sprites.js';

const m = createEmptyMap({ id: 't', name: 'T', width: 16, height: 12 });
const ids = Object.keys(TERRAIN);
for (const [k, t] of Object.entries(m.tiles)) { const [c, r] = k.split(',').map(Number); t.terrain = r < 7 ? 'grass' : ids[Math.floor(c / 2 + r / 3) % ids.length]; }
m.tiles['1,1'].terrain = 'forest'; m.tiles['2,1'].terrain = 'forest';
for (let c = 0; c < 16; c++) if (TERRAIN[m.tiles[`${c},8`].terrain].passable) m.tiles[`${c},8`].road = true;
Object.assign(m.tiles['12,1'], { building: 'tennis' }); Object.assign(m.tiles['14,1'], { building: 'golf' });
Object.assign(m.tiles['12,3'], { building: 'hockey' }); Object.assign(m.tiles['14,3'], { building: 'park' });
Object.assign(m.tiles['12,5'], { building: 'tabletennis' }); Object.assign(m.tiles['14,5'], { building: 'house' });
m.starts = [{ at: '0,0', units: [], facilities: ['12,1'] }, { at: '1,0', units: [], facilities: ['14,1'] }];
const players = PLAYER_COLORS.slice(0, 4).map((color, i) => ({ name: 'P' + i, color }));
const s = createGame(m, players, { seed: 3, startSlots: [0, 1] });
['golfer', 'tennis', 'hockey', 'jogger'].forEach((type, row) => ['m', 'f', 'd'].forEach((variant, vi) => [0, 1, 2].forEach(hair => {
  const u = spawnUnit(s, type, (vi + hair) % 4, `${vi * 3 + hair},${row + (row > 1 ? 1 : 0) + 1}`);
  u.skin = { variant, tone: (hair + vi) % 4, hair };
})));
s.units[Object.keys(s.units)[0]].hp = 3;

const canvas = document.getElementById('board');
const r = createRenderer(canvas), cam = createCamera();
r.setMap(s.tiles, 16, 12); r.resize();
const view = { camera: cam, state: s, viewer: null };
cam.zoom = Number(new URLSearchParams(location.search).get('z') || 1);
r.draw(view);
preloadSvgs();
addEventListener('resize', () => r.resize());
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(cam, e.deltaY < 0 ? 1.1 : 1 / 1.1, e.offsetX, e.offsetY); r.draw(view); }, { passive: false });
let drag = null;
canvas.addEventListener('pointerdown', e => drag = { x: e.clientX, y: e.clientY });
addEventListener('pointerup', () => drag = null);
addEventListener('pointermove', e => { if (!drag) return; cam.x -= (e.clientX - drag.x) / cam.zoom; cam.y -= (e.clientY - drag.y) / cam.zoom; drag = { x: e.clientX, y: e.clientY }; r.draw(view); });
