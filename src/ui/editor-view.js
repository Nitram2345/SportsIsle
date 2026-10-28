// Map editor: paint layers, start points with line-ups, import/export, test play.
import { createEmptyMap, loadMap, saveMap, validateMap, canPlace, uniqueMapId } from '../logic/map.js';
import { pixelToHex, parseKey, hexToPixel } from '../logic/hex.js';
import { TERRAIN, BUILDINGS, SPECIALS, UNITS, RULES } from '../config.js';
import { HEX_SIZE } from '../render/renderer.js';
import { createCamera, screenToWorld, zoomAt, centerOn } from '../render/camera.js';
import { saveLocalMap, listLocalMaps } from '../storage.js';
import { attachInput } from './input.js';

const $ = id => document.getElementById(id);
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';

export const toJson = m => saveMap(m);

const SW = {
  grass: '#6f9440', steppe: '#a3a058', beach: '#d9c78e', dunes: '#dcc27a', hillgrass: '#7f9a46', hill: '#8d9a4c', forest: '#4b6b2c',
  hillforest: '#4f6e2f', moor: '#5d6b45', mountain: '#8b8170', river: '#3d74a8', lake: '#2f68a0', sea: '#2b5d8c',
};

export function startEditorView(initial, { renderer, canvas, show, onExit, onTestPlay }) {
  let map = initial, tool = null, detach = null, saveTimer = null, assignFor = null, lastPainted = null;
  const camera = createCamera();
  const view = { camera, state: null, viewer: null, starts: [] };

  function newMapDialog() {
    const d = $('menu-dialog'), body = $('menu-body');
    body.innerHTML = `<h3 style="margin:0">Neue Map</h3>
      <label>Name <input type="text" id="nm-name" value="Meine Insel" maxlength="40"></label>
      <label>Breite (6–40) <input type="number" id="nm-w" value="16" min="6" max="40"></label>
      <label>Höhe (6–40) <input type="number" id="nm-h" value="12" min="6" max="40"></label>`;
    const row = document.createElement('div'); row.className = 'row';
    const cancel = Object.assign(document.createElement('button'), { className: 'btn alt small', textContent: 'Abbrechen' });
    const ok = Object.assign(document.createElement('button'), { className: 'btn small', textContent: 'Erstellen' });
    row.append(cancel, ok); body.append(row);
    cancel.onclick = () => { d.close(); onExit(); };
    ok.onclick = () => {
      const clamp = v => Math.min(40, Math.max(6, Math.round(Number(v) || 12)));
      const name = $('nm-name').value.trim() || 'Meine Insel';
      const id = uniqueMapId(slug(name), listLocalMaps().map(m => m.id));
      map = createEmptyMap({ id, name, author: '', width: clamp($('nm-w').value), height: clamp($('nm-h').value) });
      d.close(); begin();
    };
    d.showModal();
  }

  function begin() {
    show('editor');
    $('ed-name').value = map.meta.name;
    // id stays stable on rename (it is the storage key); export file name uses it too
    $('ed-name').oninput = () => { map.meta.name = $('ed-name').value; changed(false); };
    renderer.setMap(map.tiles, map.meta.width, map.meta.height);
    const { w, h } = renderer.worldSize();
    camera.zoom = Math.max(0.4, Math.min(1.2, canvas.clientWidth / w, (canvas.clientHeight - 140) / h));
    centerOn(camera, w / 2, h / 2, canvas.clientWidth, canvas.clientHeight);
    buildTools();
    selectTool({ layer: 'terrain', value: 'forest' });
    detach = attachInput(canvas, {
      onTap: (x, y) => paint(x, y, true),
      onPaint: (x, y) => paint(x, y, false),
      onPan: (dx, dy) => { camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom; redraw(); },
      onZoom: (f, x, y) => { zoomAt(camera, f, x, y); redraw(); },
      mode: () => (tool && ['terrain', 'road', 'building', 'special'].includes(tool.layer) ? 'paint' : 'pan'),
    });
    redraw();
  }

  const redraw = () => { view.starts = map.starts; renderer.draw(view); };

  function toast(text) {
    const t = $('ed-toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function changed(terrainChanged = true) {
    if (terrainChanged) renderer.setMap(map.tiles, map.meta.width, map.meta.height);
    redraw();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLocalMap(saveMap(map)), 1000);
  }

  // ---------- tools ----------
  function buildTools() {
    const bar = $('ed-tools'); bar.innerHTML = '';
    const group = items => { const g = document.createElement('div'); g.className = 'tool-group'; items.forEach(i => g.append(i)); bar.append(g); };
    const btn = (label, t, inner = '') => {
      const b = document.createElement('button'); b.className = 'tool'; b.innerHTML = `${inner}<span>${label}</span>`;
      b.onclick = () => selectTool(t, b); b.dataset.tool = `${t.layer}:${t.value ?? 'none'}`; return b;
    };
    group([btn('Hand', { layer: 'pan' }, '<span style="font-size:18px">✋</span>')]);
    group(Object.entries(TERRAIN).map(([id, t]) => btn(t.name.replace('hügeliges ', 'hüg. ').replace('hügeliger ', 'hüg. '), { layer: 'terrain', value: id }, `<span class="sw" style="background:${SW[id]}"></span>`)));
    group([btn('Straße', { layer: 'road', value: true }, '<span class="sw" style="background:#b5a17a;height:6px;margin:6px 0"></span>'),
           btn('Str. weg', { layer: 'road', value: false }, '<span style="font-size:16px">🚫</span>')]);
    group([...Object.entries(BUILDINGS).map(([id, b]) => btn(b.name.replace('Tischtennishalle', 'Tischtennis'), { layer: 'building', value: id }, `<img src="${b.svg}" alt="">`)),
           btn('Bau weg', { layer: 'building', value: null }, '<span style="font-size:16px">🚫</span>')]);
    group([...Object.entries(SPECIALS).map(([id, s]) => btn(s.name, { layer: 'special', value: id }, `<span style="font-size:18px">${s.icon}</span>`)),
           btn('Sonder weg', { layer: 'special', value: null }, '<span style="font-size:16px">🚫</span>')]);
    group([btn('Start', { layer: 'start' }, '<span style="font-size:18px">🚩</span>')]);
  }

  function selectTool(t, el) {
    tool = t; assignFor = null; $('ed-panel').hidden = true;
    document.querySelectorAll('#ed-tools .tool').forEach(b => b.classList.toggle('on', b.dataset.tool === `${t.layer}:${t.value ?? 'none'}`));
    el?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    if (t.layer === 'start') toast('Tippe auf ein Feld: Startpunkt setzen oder bearbeiten');
  }

  // ---------- painting ----------
  function hexAt(sx, sy) {
    const w = screenToWorld(camera, sx, sy), k = pixelToHex(w.x, w.y, HEX_SIZE);
    return map.tiles[k] ? k : null;
  }

  function paint(sx, sy, isTap) {
    const k = hexAt(sx, sy);
    if (!k) return;
    if (assignFor !== null) return assignFacility(k);
    if (!tool || tool.layer === 'pan') return;
    if (tool.layer === 'start') { if (isTap) startTap(k); return; }
    if (!isTap && k === lastPainted) return;
    lastPainted = k;
    const t = map.tiles[k];
    if (tool.layer === 'terrain') {
      if (t.terrain === tool.value) return;
      t.terrain = tool.value;
      if (t.building && !canPlace(t, t.building)) { dropBuilding(k); toast('Bebauung entfernt – hier nicht erlaubt'); }
      if (!TERRAIN[t.terrain].passable) { t.road = false; }
    } else if (tool.layer === 'road') {
      if (tool.value && !TERRAIN[t.terrain].passable) return toast('Keine Straße auf Wasser');
      if (t.road === tool.value) return;
      t.road = tool.value;
    } else if (tool.layer === 'building') {
      if (tool.value === null) { if (!t.building) return; dropBuilding(k); }
      else {
        if (!canPlace(t, tool.value)) return toast(`${BUILDINGS[tool.value].name} ist auf ${TERRAIN[t.terrain].name} nicht erlaubt`);
        if (t.building === tool.value) return;
        if (t.building) dropBuilding(k);
        t.building = tool.value;
      }
    } else if (tool.layer === 'special') {
      if (t.special === tool.value) return;
      t.special = tool.value;
    }
    changed();
  }

  function dropBuilding(k) {
    map.tiles[k].building = null;
    for (const s of map.starts) s.facilities = s.facilities.filter(f => f !== k);
  }

  // ---------- start points ----------
  function startTap(k) {
    const i = map.starts.findIndex(s => s.at === k);
    if (i >= 0) return startPanel(i);
    if (!TERRAIN[map.tiles[k].terrain].passable) return toast('Startpunkt muss begehbar sein');
    if (map.starts.length >= RULES.maxPlayers) return toast(`Höchstens ${RULES.maxPlayers} Startpunkte`);
    map.starts.push({ at: k, units: ['jogger'], facilities: [] });
    changed(false);
    startPanel(map.starts.length - 1);
  }

  function startPanel(i) {
    const s = map.starts[i], p = $('ed-panel');
    p.hidden = false; p.innerHTML = '';
    const h = document.createElement('h3'); h.textContent = `Startpunkt ${i + 1}`; p.append(h);
    const list = document.createElement('div');
    list.innerHTML = '<b>Einheiten:</b> ' + (s.units.length ? s.units.map(u => UNITS[u].name).join(', ') : '–');
    p.append(list);
    const chips = (label, items) => {
      const box = document.createElement('div'); box.className = 'chips';
      box.innerHTML = `<span style="align-self:center">${label}</span>`;
      items.forEach(([text, fn]) => { const c = document.createElement('button'); c.className = 'chip'; c.textContent = text; c.onclick = fn; box.append(c); });
      p.append(box);
    };
    chips('+', Object.entries(UNITS).map(([id, u]) => [u.name, () => { s.units.push(id); changed(false); startPanel(i); }]));
    if (s.units.length) chips('−', s.units.map((u, j) => [UNITS[u].name, () => { s.units.splice(j, 1); changed(false); startPanel(i); }]));
    const fac = document.createElement('div');
    fac.innerHTML = '<b>Sportstätten:</b> ' + (s.facilities.length ? s.facilities.map(f => BUILDINGS[map.tiles[f].building].name).join(', ') : '–');
    p.append(fac);
    chips('', [
      ['Sportstätte zuordnen', () => { assignFor = i; p.hidden = true; toast('Tippe auf eine Sportstätte'); }],
      ...(s.facilities.length ? [['Zuordnungen löschen', () => { s.facilities = []; changed(false); startPanel(i); }]] : []),
    ]);
    chips('', [
      ['Startpunkt löschen', () => { map.starts.splice(i, 1); p.hidden = true; changed(false); }],
      ['Fertig', () => { p.hidden = true; assignFor = null; }],
    ]);
  }

  function assignFacility(k) {
    const i = assignFor; assignFor = null;
    const b = BUILDINGS[map.tiles[k].building];
    if (!b?.capturable) { toast('Das ist keine Sportstätte'); return startPanel(i); }
    for (const s of map.starts) s.facilities = s.facilities.filter(f => f !== k);
    map.starts[i].facilities.push(k);
    changed(false); startPanel(i);
  }

  // ---------- menu ----------
  $('ed-menu').onclick = () => {
    const d = $('menu-dialog'), body = $('menu-body');
    body.innerHTML = '';
    const btn = (label, fn, alt) => { const b = document.createElement('button'); b.className = 'btn' + (alt ? ' alt' : ''); b.textContent = label; b.onclick = () => { d.close(); fn(); }; body.append(b); };
    btn('Weiter bearbeiten', () => {});
    btn('Testspiel', () => { const errs = validateMap(map); if (errs.length) return alertErrors(errs); finish(); onTestPlay(map); });
    btn('Exportieren (Datei)', exportMap, true);
    btn('Map importieren', () => $('ed-import').click(), true);
    btn('Neue Map', () => { finish(); startEditorView(null, { renderer, canvas, show, onExit, onTestPlay }); }, true);
    btn('Zum Hauptmenü', () => { finish(); onExit(); }, true);
    d.showModal();
  };

  function alertErrors(errs) { alert('Die Map ist noch nicht spielbar:\n\n' + errs.join('\n')); }

  function exportMap() {
    const errs = validateMap(map);
    if (errs.length) return alertErrors(errs);
    const json = saveMap(map);
    saveLocalMap(json);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 1)], { type: 'application/json' }));
    a.download = `${json.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${json.id}.json gespeichert`);
  }

  let imp = $('ed-import');
  if (!imp) { imp = Object.assign(document.createElement('input'), { type: 'file', id: 'ed-import', accept: '.json,application/json', hidden: true }); document.body.append(imp); }
  imp.onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const m = loadMap(json);
      m.meta.id = uniqueMapId(m.meta.id, listLocalMaps().map(x => x.id));
      saveLocalMap(saveMap(m));
      finish();
      startEditorView(m, { renderer, canvas, show, onExit, onTestPlay });
    } catch (err) { alert('Import fehlgeschlagen:\n' + err.message); }
  };

  function finish() {
    detach?.(); detach = null;
    clearTimeout(saveTimer);
    if (map) saveLocalMap(saveMap(map));
    $('ed-panel').hidden = true;
  }

  if (map) begin(); else newMapDialog();

  // ponytail: test hook for scripted browser checks, only with ?debug
  if (location.search.includes('debug')) window.__ed = {
    get map() { return map; },
    screenOf: k => { const [c, r] = parseKey(k), p = hexToPixel(c, r, HEX_SIZE); return [(p.x - camera.x) * camera.zoom, (p.y - camera.y) * camera.zoom + canvas.getBoundingClientRect().top]; },
  };
}
