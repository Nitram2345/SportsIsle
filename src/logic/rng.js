// Seeded RNG (mulberry32). State lives in holder.rng so it survives JSON.
export function random(holder) {
  let t = (holder.rng = (holder.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
