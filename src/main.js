// Provisional (Task 7): test map with all terrain, pan/zoom.
import { createEmptyMap } from './logic/map.js';
import { TERRAIN } from './config.js';
import { createRenderer } from './render/renderer.js';
import { createCamera, zoomAt } from './render/camera.js';

const m = createEmptyMap({ id: 't', name: 'T', width: 16, height: 12 });
const ids = Object.keys(TERRAIN);
for (const [k, t] of Object.entries(m.tiles)) { const [c, r] = k.split(',').map(Number); t.terrain = ids[Math.floor(c / 2 + r / 3) % ids.length]; }
for (let c = 0; c < 16; c++) m.tiles[`${c},5`].road = !['lake', 'sea'].includes(m.tiles[`${c},5`].terrain);
m.tiles['3,8'].special = 'sprint';

const canvas = document.getElementById('board');
const r = createRenderer(canvas), cam = createCamera();
r.setMap(m.tiles, 16, 12); r.resize();
const view = { camera: cam, state: null, viewer: null };
r.draw(view);
addEventListener('resize', () => r.resize());
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(cam, e.deltaY < 0 ? 1.1 : 1 / 1.1, e.offsetX, e.offsetY); r.draw(view); }, { passive: false });
let drag = null;
canvas.addEventListener('pointerdown', e => drag = { x: e.clientX, y: e.clientY });
addEventListener('pointerup', () => drag = null);
addEventListener('pointermove', e => { if (!drag) return; cam.x -= (e.clientX - drag.x) / cam.zoom; cam.y -= (e.clientY - drag.y) / cam.zoom; drag = { x: e.clientX, y: e.clientY }; r.draw(view); });
