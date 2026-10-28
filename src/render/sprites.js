// SVG sprites: load once, recolour placeholders per player/skin, cache as images.
import { UNITS, BUILDINGS, SKINS, PLACEHOLDER } from '../config.js';

const texts = {};          // path -> svg text
const cache = new Map();   // key -> HTMLImageElement | 'loading'
const listeners = [];

export const onSpriteReady = cb => listeners.push(cb);
const notify = () => listeners.forEach(cb => cb());

export async function preloadSvgs() {
  const paths = [...Object.values(UNITS), ...Object.values(BUILDINGS)].map(x => x.svg);
  await Promise.all(paths.map(async p => {
    try { texts[p] = await (await fetch(p)).text(); } catch { /* fallback drawing */ }
  }));
  notify();
}

function toImage(svgText, key) {
  cache.set(key, 'loading');
  const img = new Image();
  img.onload = () => { cache.set(key, img); notify(); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
}

const replaceAll = (s, from, to) => s.replace(new RegExp(from, 'gi'), to);

function variantSvg(text, skin) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  for (const v of SKINS.variants) if (v !== skin.variant) doc.getElementById(v)?.remove();
  for (let h = 0; h < SKINS.hairPerVariant; h++) if (h !== skin.hair) doc.getElementById(`${skin.variant}-hair-${h}`)?.remove();
  return new XMLSerializer().serializeToString(doc);
}

export function getUnitSprite(type, color, skin) {
  const key = `${type}|${color}|${skin.variant}|${skin.tone}|${skin.hair}`;
  const hit = cache.get(key);
  if (hit) return hit === 'loading' ? null : hit;
  const text = texts[UNITS[type].svg];
  if (!text) return null;
  let svg = variantSvg(text, skin);
  svg = replaceAll(svg, PLACEHOLDER.team, color);
  svg = replaceAll(svg, PLACEHOLDER.skin, SKINS.tones[skin.tone]);
  toImage(svg, key);
  return null;
}

export function getFacilitySprite(type) {
  const hit = cache.get(type);
  if (hit) return hit === 'loading' ? null : hit;
  const text = texts[BUILDINGS[type].svg];
  if (!text) return null;
  toImage(text, type);
  return null;
}
