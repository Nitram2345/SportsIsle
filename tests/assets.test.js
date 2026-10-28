import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, BUILDINGS, SKINS } from '../src/config.js';

test('every unit svg has variants, hair groups and placeholders', () => {
  for (const u of Object.values(UNITS)) {
    const svg = readFileSync(u.svg, 'utf8');
    assert.match(svg, /#FF00FF/i); assert.match(svg, /#00FFFF/i);
    for (const v of SKINS.variants) {
      assert.match(svg, new RegExp(`id="${v}"`), `${u.svg} ${v}`);
      for (let h = 0; h < SKINS.hairPerVariant; h++) assert.match(svg, new RegExp(`id="${v}-hair-${h}"`), `${u.svg} ${v}-hair-${h}`);
    }
  }
});
test('every building svg exists', () => { for (const b of Object.values(BUILDINGS)) assert.ok(readFileSync(b.svg, 'utf8').includes('<svg')); });
