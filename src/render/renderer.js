// Canvas renderer. Reads state + viewer's sight; never changes state.
import { parseKey, hexToPixel } from '../logic/hex.js';
import { visibleTiles, visibleUnits, maxHp } from '../logic/vision.js';
import { BUILDINGS, UNITS, SPECIALS, PLAYER_COLORS, RANKS } from '../config.js';
import { paintTerrain, hexPath, addHex } from './terrain.js';
import { getUnitSprite, getFacilitySprite, onSpriteReady } from './sprites.js';
import { cargoOf } from '../logic/transport.js';

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
    const now = performance.now();
    animating = false;      // set by idle markers / bobbing unit; keeps a light redraw loop running
    const tiles = map.tiles, fog = state && viewer !== null && viewer !== undefined;
    const seen = fog ? visibleTiles(state, viewer) : null;
    const explored = fog ? state.explored[viewer] : null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1520'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const z = cam.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    ctx.drawImage(terrain, 0, 0);

    // buildings (inner ring in owner colour for capturable ones)
    const facMarks = [];
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
      // own facilities of the active player: remembered here, drawn on top of the units below
      const f = state?.facilities[k];
      if (fog && f?.owner === viewer && viewer === state.current && b.produces.length) facMarks.push({ x, y, f });
    }

    // fog
    if (fog) {
      const dark = [], dim = [];
      for (const k of Object.keys(tiles)) { if (!explored[k]) dark.push(k); else if (!seen.has(k)) dim.push(k); }
      fill(dim, 'rgba(20,30,50,.55)'); fill(dark, '#0d1520', 1.03);
    }

    // markings
    // markings are hidden while an animation plays
    if (!anim && view.reach?.length) fill(view.reach, 'rgba(80,170,255,.30)', 0.96);
    if (!anim && view.unloads?.length) fill(view.unloads, 'rgba(52,199,89,.35)', 0.96);
    if (!anim && view.path?.length && view.selected) {
      const col = view.pathColor ?? 'rgba(255,255,255,.9)';
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([2, 6]); ctx.lineCap = 'round';
      ctx.beginPath(); [view.selected, ...view.path].forEach((k, i) => { const { x, y } = px(k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      ctx.setLineDash([]);
      const end = px(view.path[view.path.length - 1]); hexPath(ctx, end.x, end.y, HEX_SIZE, 0.9); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    }
    if (!anim && view.selected) { const { x, y } = px(view.selected); hexPath(ctx, x, y, HEX_SIZE, 0.95); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke(); }

    // units (positions may be overridden by a running animation)
    const fx = anim ? anim.frame(performance.now() - anim.t0) : null;
    if (state) {
      const units = (fog ? visibleUnits(state, viewer, seen) : Object.values(state.units))
        .concat(fx?.ghost ? [fx.ghost.unit] : [])   // unit climbing aboard is gone from the state already
        .map(u => ({ u, p: fx?.pos[u.id] ?? px(u.at) })).sort((a, b) => a.p.y - b.p.y);
      // the selected own unit bobs gently on its tile so it is easy to spot
      if (!fx && view.selected) for (const it of units) if (it.u.at === view.selected && it.u.owner === state.current) {
        it.p = { x: it.p.x, y: it.p.y - Math.abs(Math.sin(now / 260)) * 3 };
        animating = true;
      }
      const targets = new Set(fx ? [] : view.targets ?? []), heals = new Set(fx ? [] : [...(view.heals ?? []), ...(view.boards ?? [])]);
      for (const { u, p } of units) {
        const color = state.players[u.owner].color, feet = p.y + HEX_SIZE * 0.55, k = HEX_SIZE / 19 * 1.08;
        if (targets.has(u.id)) { hexPath(ctx, p.x, p.y, HEX_SIZE, 1.04); ctx.setLineDash([5, 3]); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); }
        if (heals.has(u.id)) { hexPath(ctx, p.x, p.y, HEX_SIZE, 1.04); ctx.setLineDash([5, 3]); ctx.strokeStyle = '#34c759'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(p.x, feet, 11 * k, 3.2 * k, 0, 0, 6.2832); ctx.fill();
        const img = getUnitSprite(u.type, color, u.skin);
        if (u.rank === 3) {   // profi: golden glow behind the figure
          ctx.save(); ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10; ctx.fillStyle = 'rgba(255,215,0,.35)';
          ctx.beginPath(); ctx.ellipse(p.x, feet - 22 * k, 12 * k, 23 * k, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        }
        if (img) ctx.drawImage(img, p.x - 24 * k, feet - 48 * k, 48 * k, 52 * k);  // svg viewBox -24 -48 48 52
        else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, feet - 18 * k, 10 * k, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(11 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(UNITS[u.type].name[0], p.x, feet - 18 * k); }
        const fl = fx?.flash[u.id];
        if (fl) { ctx.save(); ctx.globalAlpha = fl.alpha; ctx.fillStyle = fl.color; ctx.beginPath(); ctx.ellipse(p.x, feet - 22 * k, 13 * k, 24 * k, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
        const hp = u.hp / maxHp(u), bw = 22 * k / 1.08;
        ctx.fillStyle = '#222'; ctx.fillRect(p.x - bw / 2, feet + 3, bw, 4);
        ctx.fillStyle = hp > 0.6 ? '#4cd964' : hp > 0.3 ? '#ffcc00' : '#ff3b30'; ctx.fillRect(p.x - bw / 2, feet + 3, bw * hp, 4);
        const icons = u.buffs.map(b => SPECIALS[b.special].icon).join('') + (u.dazed || u.dazedNow ? '🤕' : '') + (u.building ? '🛤️' : '') + '🛟'.repeat(cargoOf(u).length);
        if (icons) { ctx.font = `${Math.round(HEX_SIZE * 0.4)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icons, p.x + HEX_SIZE * 0.55, feet - HEX_SIZE * 1.1); }
        // rank badge: gold stars / trophy at the top left of the figure
        const badge = UNITS[u.type].ranked ? RANKS[u.rank ?? 0].badge : '';
        if (badge) { ctx.font = `bold ${Math.round(HEX_SIZE * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(badge, p.x - HEX_SIZE * 0.62, feet - HEX_SIZE * 1.62); ctx.fillStyle = '#ffd700'; ctx.fillText(badge, p.x - HEX_SIZE * 0.62, feet - HEX_SIZE * 1.62); }
        if (u.owner === state.current && fog && !u.hasMoved && !u.hasAttacked) { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(p.x - HEX_SIZE * 0.5, feet - HEX_SIZE * 1.1, 3.5, 0, 6.2832); ctx.fill(); }
      }
    }

    // facility markers on top of units: 💤 when idle (pulsing, top right), progress bar when producing
    for (const { x, y, f } of facMarks) {
      if (!f.producing) {
        const pulse = 1 + 0.12 * Math.sin(now / 300);
        ctx.save(); ctx.translate(x + HEX_SIZE * 0.62, y - HEX_SIZE * 0.75); ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0, 0, HEX_SIZE * 0.34, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.font = `${Math.round(HEX_SIZE * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; ctx.fillText('💤', 0, 1); ctx.restore();
        animating = true;
      } else if (f.needed) {
        const bw = HEX_SIZE * 1.1, by = y + HEX_SIZE * 0.62, pr = Math.min(1, f.progress / f.needed);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = '#5ac8fa'; ctx.fillRect(x - bw / 2, by, bw * pr, 4);
      }
    }

    // animation overlays: projectiles and floating numbers
    if (fx) {
      for (const s of fx.shots) {
        const col = s.kind === 'tennis' ? '#d8f040' : s.kind === 'climber' ? '#8e8a82' : s.kind === 'hockey' ? '#f2f2f2' : '#fff';
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + HEX_SIZE * 0.9, 3, 1.2, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = col; ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, 3.6, 0, 6.2832); ctx.fill(); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.round(HEX_SIZE * 0.6)}px system-ui, sans-serif`;
      for (const t of fx.texts) {
        ctx.save(); ctx.globalAlpha = t.alpha; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); ctx.restore();
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
    // idle markers / bobbing unit: keep redrawing at ~30 fps while needed (not during play())
    if (animating && !anim && !idleTimer) idleTimer = setTimeout(() => { idleTimer = null; draw(view); }, 33);
  }
  let animating = false, idleTimer = null;

  // play(animation): redraw every frame until it ends, then resolve
  let anim = null;
  function play(a) {
    if (!a || a.duration <= 0) return Promise.resolve();
    return new Promise(resolve => {
      anim = { ...a, t0: performance.now(), resolve };
      const tick = () => {
        render();
        if (performance.now() - anim.t0 < anim.duration) requestAnimationFrame(tick);
        else { const r = anim.resolve; anim = null; render(); r(); }
      };
      requestAnimationFrame(tick);
    });
  }

  return { setMap, draw, resize, play, worldSize: () => ({ w: terrain.width, h: terrain.height }) };
}
