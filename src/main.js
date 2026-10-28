// App shell: screens, menus, new game setup, routing to game/editor views.
import { loadMap } from './logic/map.js';
import { createGame, suggestStarts } from './logic/game.js';
import { parseKey, hexToPixel } from './logic/hex.js';
import { PLAYER_COLORS, RULES } from './config.js';
import { createRenderer } from './render/renderer.js';
import { preloadSvgs } from './render/sprites.js';
import { startGameView } from './ui/game-view.js';
import { loadGame, listLocalMaps, saveLocalMap } from './storage.js';

const $ = id => document.getElementById(id);
const canvas = $('board');
const renderer = createRenderer(canvas);
addEventListener('resize', () => renderer.resize());
renderer.resize();
preloadSvgs();

export function show(name) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  if (name === 'start') $('btn-continue').hidden = !loadGame();
  if (name === 'new') openNewGame();
  if (name === 'editor') openEditor();
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

// ---------- maps ----------
let bundled = [];
async function loadIndex() {
  try { bundled = await (await fetch('maps/index.json')).json(); } catch { bundled = []; }
}
async function allMaps() {
  if (!bundled.length) await loadIndex();
  return [
    ...bundled.map(e => ({ id: e.id, name: e.name, source: 'bundled', file: e.file, players: e.players, width: e.width, height: e.height })),
    ...listLocalMaps().map(j => ({ id: 'local:' + j.id, name: j.name + ' (eigene)', source: 'local', json: j, players: { min: 2, max: j.starts.length }, width: j.width, height: j.height })),
  ];
}
async function fetchMap(entry) {
  const json = entry.source === 'local' ? entry.json : await (await fetch('maps/' + entry.file)).json();
  return loadMap(json);
}

// ---------- new game ----------
let ng = { entries: [], map: null, slots: [], seed: 1, preselect: null };

async function openNewGame() {
  ng.entries = (await allMaps()).filter(e => e.players.max >= 2);
  const sel = $('new-map');
  sel.innerHTML = ng.entries.map((e, i) => `<option value="${i}">${e.name} (${e.players.max} Spieler, ${e.width}×${e.height})</option>`).join('');
  if (ng.preselect) { const i = ng.entries.findIndex(e => e.id === ng.preselect); if (i >= 0) sel.value = i; ng.preselect = null; }
  await pickMap();
}

async function pickMap() {
  const entry = ng.entries[$('new-map').value];
  if (!entry) { $('new-map-info').textContent = 'Keine Maps gefunden.'; return; }
  try { ng.map = await fetchMap(entry); } catch (e) { $('new-map-info').textContent = e.message; ng.map = null; return; }
  const max = Math.min(ng.map.starts.length, RULES.maxPlayers);
  $('new-map-info').textContent = ng.map.meta.author ? `von ${ng.map.meta.author}` : '';
  const count = $('new-count'), prev = Number(count.value) || 2;
  count.innerHTML = Array.from({ length: max - 1 }, (_, i) => `<option>${i + 2}</option>`).join('');
  count.value = Math.min(prev, max);
  playerRows();
}

function playerRows() {
  const n = Number($('new-count').value), box = $('new-players');
  const old = [...box.querySelectorAll('.player-row')].map(r => ({ name: r.querySelector('input').value, color: r.querySelector('select').value }));
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const row = document.createElement('div'); row.className = 'player-row';
    const color = old[i]?.color ?? PLAYER_COLORS[i];
    row.innerHTML = `<span class="swatch" style="background:${color}"></span><input type="text" maxlength="16" value="${old[i]?.name ?? `Spieler ${i + 1}`}">`
      + `<select aria-label="Farbe">${PLAYER_COLORS.map((c, j) => `<option value="${c}" ${c === color ? 'selected' : ''} style="background:${c}">${j + 1}</option>`).join('')}</select>`;
    row.querySelector('select').onchange = e => { row.querySelector('.swatch').style.background = e.target.value; };
    box.append(row);
  }
  ng.seed = Date.now() | 0;
  reroll(false);
}

function reroll(newSeed = true) {
  if (!ng.map) return;
  if (newSeed) ng.seed = (ng.seed * 1103515245 + 12345) | 0;
  ng.slots = suggestStarts(ng.map, Number($('new-count').value), ng.seed);
  preview();
}

function preview() {
  const c = $('new-preview'), ctx = c.getContext('2d'), m = ng.map, { width, height } = m.meta;
  const size = Math.min(c.width / (Math.sqrt(3) * (width + 0.5)), c.height / (1.5 * height + 0.5));
  ctx.fillStyle = '#0d1520'; ctx.fillRect(0, 0, c.width, c.height);
  const COL = { sea: '#2b5d8c', lake: '#2f68a0', river: '#3d74a8', mountain: '#8b8170', forest: '#4b6b2c', hillforest: '#4f6e2f', beach: '#d9c78e', dunes: '#dcc27a', moor: '#5d6b45' };
  for (const [k, t] of Object.entries(m.tiles)) {
    const [x, y] = parseKey(k), p = hexToPixel(x, y, size);
    ctx.fillStyle = t.building ? '#eee' : COL[t.terrain] ?? '#6f9440';
    ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.95, 0, 6.3); ctx.fill();
  }
  const rows = [...$('new-players').querySelectorAll('select')];
  ng.slots.forEach((slot, i) => {
    const [x, y] = parseKey(m.starts[slot].at), p = hexToPixel(x, y, size);
    ctx.fillStyle = rows[i]?.value ?? PLAYER_COLORS[i]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(7, size * 1.6), 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, p.x, p.y + 1);
  });
}

$('new-map').onchange = pickMap;
$('new-count').onchange = playerRows;
$('new-reroll').onclick = () => reroll(true);
$('new-players').addEventListener('change', preview);
$('new-start').onclick = () => {
  if (!ng.map) return;
  const players = [...$('new-players').querySelectorAll('.player-row')].map((r, i) => ({ name: r.querySelector('input').value.trim() || `Spieler ${i + 1}`, color: r.querySelector('select').value }));
  if (new Set(players.map(p => p.color)).size !== players.length) { alert('Jeder Spieler braucht eine eigene Farbe.'); return; }
  play(createGame(ng.map, players, { seed: ng.seed, startSlots: ng.slots }));
};

function play(state) {
  startGameView(state, { renderer, canvas, show, onExit: () => show('start') });
}

$('btn-continue').onclick = () => { const s = loadGame(); if (s) play(s); };

// ---------- import / editor ----------
$('import-file').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    loadMap(json);
    saveLocalMap(json);
    $('start-msg').textContent = `Map „${json.name}" importiert.`;
    openEditorWith(loadMap(json));
  } catch (err) { $('start-msg').textContent = 'Import fehlgeschlagen:\n' + err.message; }
};

let editorModule = null;
async function openEditor(map = null) {
  editorModule ??= await import('./ui/editor-view.js').catch(() => null);
  if (!editorModule) { $('start-msg').textContent = 'Editor kommt bald.'; show('start'); return; }
  editorModule.startEditorView(map, {
    renderer, canvas, show,
    onExit: () => show('start'),
    onTestPlay: m => { saveLocalMap(editorModule.toJson(m)); ng.preselect = 'local:' + m.meta.id; show('new'); },
  });
}
function openEditorWith(map) {
  document.querySelectorAll('[data-screen]').forEach(s => s.classList.toggle('active', s.dataset.screen === 'editor'));
  openEditor(map);
}

show('start');
