// Hex math: pointy-top, odd-r offset coords ("c,r"), cube coords internally.

export const key = (c, r) => `${c},${r}`;
export const parseKey = k => k.split(',').map(Number);

export function toCube(c, r) {
  const x = c - (r - (r & 1)) / 2;
  return [x, -x - r, r];
}

function cubeToKey([x, , z]) {
  return key(x + (z - (z & 1)) / 2, z);
}

function cubeRound(p) {
  const q = p.map(Math.round);
  const d = p.map((v, i) => Math.abs(q[i] - v));
  if (d[0] > d[1] && d[0] > d[2]) q[0] = -q[1] - q[2];
  else if (d[1] > d[2]) q[1] = -q[0] - q[2];
  else q[2] = -q[0] - q[1];
  return q;
}

export function distance(a, b) {
  const A = toCube(...parseKey(a)), B = toCube(...parseKey(b));
  return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2]));
}

// Order: E, NE, NW, W, SW, SE
const DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];

const inside = (k, width, height) => {
  const [c, r] = parseKey(k);
  return c >= 0 && r >= 0 && c < width && r < height;
};

export function neighbors(k, width, height) {
  const C = toCube(...parseKey(k));
  return DIRS.map(d => cubeToKey([C[0] + d[0], C[1] + d[1], C[2] + d[2]]))
    .filter(n => inside(n, width, height));
}

export function hexesInRange(k, n, width, height) {
  const C = toCube(...parseKey(k)), out = [];
  for (let dx = -n; dx <= n; dx++)
    for (let dy = Math.max(-n, -dx - n); dy <= Math.min(n, -dx + n); dy++) {
      const h = cubeToKey([C[0] + dx, C[1] + dy, C[2] - dx - dy]);
      if (inside(h, width, height)) out.push(h);
    }
  return out;
}

// Hexes strictly between a and b. Each step is [key] or, if the line runs
// exactly along an edge, [key1, key2].
const EPS = [1e-6, 2e-6, -3e-6];
export function lineBetween(a, b) {
  const A = toCube(...parseKey(a)), B = toCube(...parseKey(b)), n = distance(a, b), out = [];
  for (let i = 1; i < n; i++) {
    const p = [0, 1, 2].map(j => A[j] + (B[j] - A[j]) * i / n);
    const k1 = cubeToKey(cubeRound(p.map((v, j) => v + EPS[j])));
    const k2 = cubeToKey(cubeRound(p.map((v, j) => v - EPS[j])));
    out.push(k1 === k2 ? [k1] : [k1, k2]);
  }
  return out;
}

const SQ3 = Math.sqrt(3);

export function hexToPixel(c, r, size) {
  return { x: SQ3 * size * (c + 0.5 * (r & 1)) + SQ3 * size / 2, y: 1.5 * size * r + size };
}

export function pixelToHex(x, y, size) {
  const px = x - SQ3 * size / 2, py = y - size;
  const q = (SQ3 / 3 * px - py / 3) / size, r = (2 / 3 * py) / size;
  return cubeToKey(cubeRound([q, -q - r, r]));
}
