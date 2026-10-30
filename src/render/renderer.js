// Canvas renderer. Reads state + viewer's sight; never changes state.
import { parseKey, hexToPixel } from '../logic/hex.js';
import { visibleTiles, visibleUnits } from '../logic/vision.js';
import { BUILDINGS, UNITS, SPECIALS, PLAYER_COLORS } from '../config.js';
import { paintTerrain, hexPath, addHex } from './terrain.js';
import { getUnitSprite, getFacilitySprite, onSpriteReady } from './sprites.js';

export const HEX_SIZE = 32;
const NEUTRAL = '#d8d8d8';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const terrain = document.createElement('canvas');
  let map = null, view = null, pending = false, dpr = 1;

  const px = k => { const [c, r] = parseKey(k); return hexToPixel(c, r, HEX_SIZE); };

  function setMap(tiles, width, height) {
    map = { tiles, width, height };
    terrain.width = Math.ceil(Math.sqrt(3) * HEX_SIZE * (width + 0.5)) + 2;
    terrain.height = Math.ceil(1.5 * HEX_SIZE * height + HEX_SIZE / 2) + 2;
    const tctx = terrain.getContext('2d');
    tctx.clearRect(0, 0, terrain.width, terrain.height);
    paintTerrain(tctx, tiles, width, height, HEX_SIZE);
    draw(view);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    draw(view);
  }

  function draw(v) {
    view = v;
    if (pending || !view || !map) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }
  onSpriteReady(() => draw(view));

  function fill(keys, style, scale = 1.01) {
    ctx.beginPath();
    for (const k of keys) { const { x, y } = px(k); addHex(ctx, x, y, HEX_SIZE, scale); }
    ctx.fillStyle = style; ctx.fill();
  }

  function render() {
    const { camera: cam, state, viewer } = view;
    const tiles = map.tiles, fog = state && viewer !== null && viewer !== undefined;
    const seen = fog ? visibleTiles(state, viewer) : null;
    const explored = fog ? state.explored[viewer] : null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1520'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const z = cam.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    ctx.drawImage(terrain, 0, 0);

    // buildings (inner ring in owner colour for capturable ones)
    for (const [k, t] of Object.entries(tiles)) {
      if (!t.building || (fog && !explored[k])) continue;
      const { x, y } = px(k), b = BUILDINGS[t.building];
      if (b.capturable) {
        let owner = null;
        if (fog) owner = state.lastSeen[viewer][k] ?? null;
        else if (state) owner = state.facilities[k]?.owner ?? null;
        hexPath(ctx, x, y, HEX_SIZE, 0.84);
        ctx.strokeStyle = owner === null ? NEUTRAL : state.players[owner].color; ctx.lineWidth = 3.4; ctx.stroke();
      }
      const img = getFacilitySprite(t.building), s = HEX_SIZE * 2.33;  // svg viewBox 56 for hex radius 24
      if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
      else { ctx.fillStyle = '#d9d2c3'; ctx.fillRect(x - 12, y - 9, 24, 18); ctx.fillStyle = '#333'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name.slice(0, 3), x, y + 4); }
    }

    // fog
    if (fog) {
      const dark = [], dim = [];
      for (const k of Object.keys(tiles)) { if (!explored[k]) dark.push(k); else if (!seen.has(k)) dim.push(k); }
      fill(dim, 'rgba(20,30,50,.55)'); fill(dark, '#0d1520', 1.03);
    }

    // markings
    if (view.reach?.length) fill(view.reach, 'rgba(80,170,255,.30)', 0.96);
    if (view.path?.length && view.selected) {
      const col = view.pathColor ?? 'rgba(255,255,255,.9)';
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([2, 6]); ctx.lineCap = 'round';
      ctx.beginPath(); [view.selected, ...view.path].forEach((k, i) => { const { x, y } = px(k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      ctx.setLineDash([]);
      const end = px(view.path[view.path.length - 1]); hexPath(ctx, end.x, end.y, HEX_SIZE, 0.9); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    }
    if (view.selected) { const { x, y } = px(view.selected); hexPath(ctx, x, y, HEX_SIZE, 0.95); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke(); }

    // units
    if (state) {
      const units = (fog ? visibleUnits(state, viewer, seen) : Object.values(state.units))
        .map(u => ({ u, p: px(u.at) })).sort((a, b) => a.p.y - b.p.y);
      const targets = new Set(view.targets ?? []);
      for (const { u, p } of units) {
        const color = state.players[u.owner].color, feet = p.y + HEX_SIZE * 0.55, k = HEX_SIZE / 19 * 1.08;
        if (targets.has(u.id)) { hexPath(ctx, p.x, p.y, HEX_SIZE, 1.04); ctx.setLineDash([5, 3]); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(p.x, feet, 11 * k, 3.2 * k, 0, 0, 6.2832); ctx.fill();
        const img = getUnitSprite(u.type, color, u.skin);
        if (img) ctx.drawImage(img, p.x - 24 * k, feet - 48 * k, 48 * k, 52 * k);  // svg viewBox -24 -48 48 52
        else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, feet - 18 * k, 10 * k, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(11 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(UNITS[u.type].name[0], p.x, feet - 18 * k); }
        const hp = u.hp / UNITS[u.type].hp, bw = 22 * k / 1.08;
        ctx.fillStyle = '#222'; ctx.fillRect(p.x - bw / 2, feet + 3, bw, 4);
        ctx.fillStyle = hp > 0.6 ? '#4cd964' : hp > 0.3 ? '#ffcc00' : '#ff3b30'; ctx.fillRect(p.x - bw / 2, feet + 3, bw * hp, 4);
        const icons = u.buffs.map(b => SPECIALS[b.special].icon).join('') + (u.dazed || u.dazedNow ? '🤕' : '');
        if (icons) { ctx.font = `${Math.round(HEX_SIZE * 0.4)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icons, p.x + HEX_SIZE * 0.55, feet - HEX_SIZE * 1.1); }
        if (u.owner === state.current && fog && !u.hasMoved && !u.hasAttacked) { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(p.x - HEX_SIZE * 0.5, feet - HEX_SIZE * 1.1, 3.5, 0, 6.2832); ctx.fill(); }
      }
    }

    // editor: start points
    (view.starts ?? []).forEach((s, i) => {
      const { x, y } = px(s.at);
      ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, HEX_SIZE * 0.45, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(HEX_SIZE * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 1);
      for (const f of s.facilities) { const q = px(f); hexPath(ctx, q.x, q.y, HEX_SIZE, 0.84); ctx.strokeStyle = PLAYER_COLORS[i % PLAYER_COLORS.length]; ctx.lineWidth = 3.4; ctx.stroke(); }
    });
  }

  return { setMap, draw, resize, worldSize: () => ({ w: terrain.width, h: terrain.height }) };
}
