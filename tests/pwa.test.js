import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name).split(String.fromCharCode(92)).join('/')]);

test('service worker caches every app file', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const files = ['index.html', 'style.css', 'manifest.json', ...['src', 'units', 'facilities', 'icons'].flatMap(walk), 'maps/index.json'];
  for (const f of files) assert.ok(shell.includes(f), `missing in SHELL: ${f}`);
  for (const f of shell) if (f !== './') assert.ok(files.includes(f), `SHELL lists unknown file: ${f}`);
});
test('manifest is installable', () => {
  const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
  assert.equal(m.name, 'Sports Battle Isle'); assert.equal(m.short_name, 'SportsIsle');
  assert.equal(m.display, 'fullscreen'); assert.equal(m.start_url, './');
  assert.ok(m.icons.some(i => i.src === 'icons/icon.svg'));
  assert.ok(readFileSync('index.html', 'utf8').includes('rel="manifest"'));
});
