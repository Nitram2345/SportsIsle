// Terrain painting in Battle Isle 2 style (port of docs/design-reference/look-v3.html).
// Runs once per map into an offscreen canvas.
import { parseKey, hexToPixel, neighbors } from '../logic/hex.js';
import { SPECIALS } from '../config.js';

const BASE = {
  grass: '#6f9440', steppe: '#a3a058', beach: '#d9c78e', dunes: '#dcc27a', hillgrass: '#7f9a46',
  hill: '#8d9a4c', forest: '#4b6b2c', hillforest: '#4f6e2f', moor: '#5d6b45', mountain: '#8b8170',
  river: '#3d74a8', lake: '#2f68a0', sea: '#2b5d8c',
};

// Appends one hex as a subpath (no beginPath), so many hexes can share one fill.
export function addHex(ctx, x, y, size, scale = 1) {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    const px = x + size * scale * Math.cos(a), py = y + size * scale * Math.sin(a);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function hexPath(ctx, x, y, size, scale = 1) {
  ctx.beginPath();
  addHex(ctx, x, y, size, scale);
}

// Stable per-tile randomness.
function tileRng(c, r) {
  let s = ((c * 73856093) ^ (r * 19349663)) >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const dot = (ctx, x, y, rad, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill(); };
const ellipse = (ctx, x, y, rx, ry, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.fill(); };
const poly = (ctx, pts, color) => { ctx.fillStyle = color; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
const wave = (ctx, x, y, w, color, lw) => {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w / 2, y - w * 0.6, x, y); ctx.quadraticCurveTo(x + w / 2, y + w * 0.6, x + w, y); ctx.stroke();
};

function paintDetail(ctx, terrain, x, y, R, rnd) {
  const k = R / 19;  // design reference used R=19
  const spread = f => [(rnd() - 0.5) * R * f, (rnd() - 0.5) * R * f];
  const speckle = (n, colors, rad) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * R * 0.75; dot(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, rad * k, colors[i % colors.length]); } };
  const trees = n => { for (let i = 0; i < n; i++) { const [ox, oy] = spread(1.2); dot(ctx, x + ox + k, y + oy + 1.5 * k, 4.6 * k, '#22361a'); dot(ctx, x + ox, y + oy, 4.4 * k, '#2f5022'); dot(ctx, x + ox - 1.3 * k, y + oy - 1.3 * k, 2 * k, '#5b8a38'); } };
  const bumps = () => [[-6, 4], [6, 2], [0, -5]].forEach(([dx, dy]) => { ellipse(ctx, x + dx * k, y + dy * k, 8 * k, 5 * k, '#a3ae5c'); ellipse(ctx, x + (dx + 2) * k, y + (dy + 1.5) * k, 6 * k, 3.2 * k, '#6f7c35'); });
  switch (terrain) {
    case 'grass': speckle(9, ['#86ad52', '#5a7d33'], 1.1); break;
    case 'steppe': speckle(10, ['#c2bb6c', '#8a8a44'], 1); for (let i = 0; i < 3; i++) { const [ox, oy] = spread(1.1); ctx.strokeStyle = '#7b7a3a'; ctx.lineWidth = k; ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox - 2 * k, y + oy - 4 * k); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + 2 * k, y + oy - 4 * k); ctx.stroke(); } break;
    case 'beach': speckle(10, ['#b9a46a'], 0.9); break;
    case 'dunes': speckle(8, ['#b9a46a'], 0.9); for (let i = -1; i <= 1; i++) wave(ctx, x, y + (i * 6 + 2) * k, 10 * k, '#b8963f', 1.6 * k); break;
    case 'hillgrass': speckle(8, ['#86ad52', '#5a7d33'], 1.1); bumps(); break;
    case 'hill': bumps(); speckle(5, ['#5a7d33'], 1); break;
    case 'forest': trees(7); break;
    case 'hillforest': bumps(); trees(4); break;
    case 'moor': for (let i = 0; i < 6; i++) { const [ox, oy] = spread(1.2); ellipse(ctx, x + ox, y + oy, 4 * k, 1.6 * k, '#3c5a5a'); ctx.strokeStyle = '#7a8a3a'; ctx.lineWidth = k; ctx.beginPath(); ctx.moveTo(x + ox - k, y + oy); ctx.lineTo(x + ox - 2 * k, y + oy - 4 * k); ctx.stroke(); } break;
    case 'mountain':
      poly(ctx, [[x - 14 * k, y + 9 * k], [x - 3 * k, y - 12 * k], [x + 6 * k, y + 9 * k]], '#9b917f');
      poly(ctx, [[x - 3 * k, y - 12 * k], [x + 6 * k, y + 9 * k], [x - k, y + 9 * k]], '#6a6152');
      poly(ctx, [[x - 3 * k, y - 12 * k], [x - 6 * k, y - 6 * k], [x - k, y - 7 * k]], '#f2f2f2');
      poly(ctx, [[x, y + 10 * k], [x + 8 * k, y - 5 * k], [x + 15 * k, y + 10 * k]], '#8f8573');
      poly(ctx, [[x + 8 * k, y - 5 * k], [x + 15 * k, y + 10 * k], [x + 10 * k, y + 10 * k]], '#5f5747');
      break;
    case 'river': case 'lake': case 'sea': for (let i = 0; i < 3; i++) { const [ox, oy] = spread(1); wave(ctx, x + ox, y + oy, 5 * k, terrain === 'river' ? '#6fa0cf' : '#5b8dbd', 1.3 * k); } break;
  }
}

export function paintTerrain(ctx, tiles, width, height, size) {
  // 1) ground + detail
  for (const [k, t] of Object.entries(tiles)) {
    const [c, r] = parseKey(k), { x, y } = hexToPixel(c, r, size);
    hexPath(ctx, x, y, size * 1.01);
    ctx.fillStyle = BASE[t.terrain]; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.8; ctx.stroke();
    paintDetail(ctx, t.terrain, x, y, size, tileRng(c, r));
  }
  // 2) roads: connect road tiles to road neighbours; lone road tile = short stub
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, color] of [[size * 0.37, '#5a4c38'], [size * 0.24, '#b5a17a']]) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    for (const [k, t] of Object.entries(tiles)) {
      if (!t.road) continue;
      const [c, r] = parseKey(k), a = hexToPixel(c, r, size);
      const ns = neighbors(k, width, height).filter(n => tiles[n].road);
      ctx.beginPath();
      if (!ns.length) { ctx.moveTo(a.x - size * 0.4, a.y); ctx.lineTo(a.x + size * 0.4, a.y); }
      for (const n of ns) { const [nc, nr] = parseKey(n), b = hexToPixel(nc, nr, size); ctx.moveTo(a.x, a.y); ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2); }
      ctx.stroke();
    }
  }
  // 3) special fields
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [k, t] of Object.entries(tiles)) {
    if (!t.special) continue;
    const [c, r] = parseKey(k), { x, y } = hexToPixel(c, r, size);
    ctx.setLineDash([3, 2]); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,230,80,.35)';
    ctx.beginPath(); ctx.arc(x, y, size * 0.55, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${Math.round(size * 0.65)}px sans-serif`; ctx.fillStyle = '#000';
    ctx.fillText(SPECIALS[t.special].icon, x, y + 1);
  }
}
