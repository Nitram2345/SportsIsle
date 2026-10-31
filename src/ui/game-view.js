// Hot-seat game screen: hand-over, map interaction, HUD, production, victory.
import { apply, productionTime, idleUnits } from '../logic/game.js';
import { reachable } from '../logic/movement.js';
import { attackTargets, healTargets } from '../logic/combat.js';
import { ramTargets } from '../logic/ram.js';
import { visibleUnits, knownOwner, effective } from '../logic/vision.js';
import { parseKey, hexToPixel, pixelToHex } from '../logic/hex.js';
import { UNITS, BUILDINGS, SPECIALS } from '../config.js';
import { HEX_SIZE } from '../render/renderer.js';
import { createCamera, screenToWorld, zoomAt, centerOn } from '../render/camera.js';
import { saveGame, clearGame } from '../storage.js';
import { attachInput } from './input.js';

const $ = id => document.getElementById(id);

export function startGameView(initial, { renderer, canvas, show, onExit }) {
  let state = initial, sel = null, pending = null, detach = null, eliminatedNote = '', rams = {};
  const camera = createCamera();
  const view = { camera, state, viewer: null, selected: null, reach: [], targets: [] };

  renderer.setMap(state.tiles, state.width, state.height);
  saveGame(state);

  const redraw = () => { Object.assign(view, { state, viewer: state.current }); renderer.draw(view); updateNext(); };

  // "Next unit": cycles through own units that have not acted yet; when none is left the
  // button gives way to a "all moved" note.
  function updateNext() {
    const idle = idleUnits(state);
    $('hud-next').hidden = !idle.length;
    $('hud-done').hidden = !!idle.length;
    if (idle.length) $('hud-next').textContent = `Nächste Einheit (${idle.length})`;
  }
  function nextUnit() {
    const idle = idleUnits(state);
    if (!idle.length) return;
    const after = sel?.kind === 'unit' ? idle.indexOf(sel.id) + 1 : 0;
    const id = idle[after % idle.length];
    const [c, r] = parseKey(state.units[id].at), p = hexToPixel(c, r, HEX_SIZE);
    centerOn(camera, p.x, p.y, canvas.clientWidth, canvas.clientHeight);
    select('unit', id);
  }

  function toast(text) {
    const t = $('toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function describe(events) {
    const name = p => state.players[p].name, out = [];
    for (const e of events) {
      if (e.type === 'discovered') out.push('Feind entdeckt!');
      if (e.type === 'captured') out.push(`${BUILDINGS[state.tiles[e.at].building].name} erobert`);
      if (e.type === 'damage') out.push(`Treffer: -${e.amount} ❤`);
      if (e.type === 'counter') out.push('🥋 Gegenschlag!');
      if (e.type === 'ram') out.push('🏉 Gerammt!');
      if (e.type === 'healed') out.push(`➕ Behandelt: +${e.amount} ❤`);
      if (e.type === 'pushed') out.push('Gegner zurückgedrängt');
      if (e.type === 'blocked') out.push('Gegner konnte nicht ausweichen');
      if (e.type === 'zone') out.push('Zone des Gegners – Halt!');
      if (e.type === 'killed') out.push('Einheit ausgeschaltet');
      if (e.type === 'eliminated') out.push(`${name(e.player)} ist ausgeschieden`);
      if (e.type === 'buff') out.push(`${SPECIALS[e.special].icon} ${SPECIALS[e.special].name}!`);
      if (e.type === 'produced' && state.units[e.unitId]?.owner === state.current) out.push(`${UNITS[state.units[e.unitId].type].name} ist bereit`);
    }
    if (out.length) toast(out.join('\n'));
  }

  function act(action) {
    try {
      const r = apply(state, action);
      state = r.state;
      saveGame(state);
      // end of turn: nothing of the previous player may leak past the hand-over;
      // eliminations are shown on the hand-over screen instead
      if (action.type === 'endTurn') {
        eliminatedNote = r.events.filter(e => e.type === 'eliminated').map(e => `${state.players[e.player].name} ist ausgeschieden`).join('\n');
      } else describe(r.events);
      if (state.winner !== null) return victory();
      return r.events;
    } catch (err) { toast(err.message); return null; }
  }

  // ---------- selection ----------
  function select(kind, id) {
    sel = kind ? { kind, id } : null; pending = null; rams = {};
    view.reach = []; view.targets = []; view.heals = []; view.selected = null; view.path = null; view.pathColor = null;
    if (kind === 'unit') {
      const u = state.units[id];
      view.selected = u.at;
      if (u.owner === state.current) {
        if (!u.hasAttacked && !u.attacksUsed && u.movesLeft > 0) view.reach = Object.keys(reachable(state, id));
        if (!u.hasMoved && !u.hasAttacked) view.targets = attackTargets(state, id);
        rams = ramTargets(state, id);
        view.targets = [...view.targets, ...Object.keys(rams)];
        view.heals = healTargets(state, id);
      }
    }
    if (kind === 'facility') view.selected = id;
    info(); redraw();
  }

  function info() {
    const box = $('hud-info');
    box.innerHTML = '';
    if (!sel) { box.innerHTML = `<span class="hint">Einheit oder Sportstätte antippen</span>`; return; }
    const div = document.createElement('div'), title = document.createElement('div'), line = document.createElement('div');
    title.className = 'title'; div.append(title, line); box.append(div);
    if (sel.kind === 'unit') {
      const u = state.units[sel.id], cfg = UNITS[u.type], mine = u.owner === state.current;
      const buffs = u.buffs.map(b => `${SPECIALS[b.special].icon}${b.turns}`).join(' ');
      const range = effective(u, 'range');
      title.textContent = cfg.name + (mine ? '' : ` (${state.players[u.owner].name})`);
      line.textContent = `❤ ${u.hp}/${cfg.hp} · ⚔ ${effective(u, 'atk')} · 🛡 ${effective(u, 'def')} · 👟 ${mine ? u.movesLeft + '/' : ''}${effective(u, 'move')}${range ? ` · 🎯 ${range}` : ''} ${buffs}`;
      if (cfg.multiMove) line.textContent += ' · 🔁 kann mehrmals ziehen';
      if (cfg.zoc) line.textContent += ' · 🧱 blockiert Nachbarfelder';
      if (cfg.counter) line.textContent += ' · 🥋 schlägt zurück';
      if (cfg.ram) line.textContent += ' · 🏉 rammt (mind. 2 Felder Anlauf)';
      if (cfg.climb) line.textContent += ' · 🧗 klettert; auf dem Berg +2 Sicht; bergab +1 Angriff/Reichweite';
      if (cfg.swim) line.textContent += ' · 🏊 schwimmt; an Land langsam';
      if (cfg.attacks > 1) line.textContent += ` · 🏓 ${cfg.attacks} Angriffe pro Zug` + (mine && u.attacksUsed && !u.hasAttacked ? ` (noch ${cfg.attacks - u.attacksUsed})` : '');
      if (cfg.heal) line.textContent += ` · ➕ behandelt Nachbarn (+${cfg.heal} ❤)`;
      if (u.dazedNow || u.dazed) line.textContent += u.dazedNow ? ' · 🤕 angeschlagen: kein Angriff, halbe Bewegung' : ' · 🤕 nächste Runde angeschlagen';
      if (u.retreatTo && mine) line.textContent += ' · nur zurück möglich';
      if (mine && pending) { const b = document.createElement('b'); b.textContent = rams && Object.values(rams).some(p => p[p.length - 1] === pending) ? 'Nochmal tippen zum Rammen' : 'Nochmal tippen zum Bewegen'; div.append(b); }
      return;
    }
    const f = state.facilities[sel.id], b = BUILDINGS[f.type], mine = f.owner === state.current;
    const owner = knownOwner(state, state.current, sel.id);
    title.textContent = b.name;
    if (!mine) line.textContent = owner === null ? 'Neutral – mit einer Einheit erobern' : `Gehört ${state.players[owner].name}`;
    else if (!b.produces.length) line.textContent = 'Stellt im Moment nichts her';
    else {
      line.textContent = f.producing ? `Baut ${UNITS[f.producing].name}: ${f.progress}/${f.needed}` : 'Keine Produktion';
      const chips = document.createElement('div'); chips.className = 'chips';
      for (const type of b.produces) {
        const t = productionTime(state, state.current, type);
        const c = document.createElement('button'); c.className = 'chip' + (f.producing === type ? ' on' : '');
        c.textContent = t === null ? `${UNITS[type].name} (Limit)` : `${UNITS[type].name} · ${t} Züge`;
        c.disabled = t === null;
        c.onclick = () => { act({ type: 'produce', at: sel.id, unitType: type }); select('facility', sel.id); };
        chips.append(c);
      }
      if (f.producing) {
        const stop = document.createElement('button'); stop.className = 'chip'; stop.textContent = 'Stopp';
        stop.onclick = () => { act({ type: 'produce', at: sel.id, unitType: null }); select('facility', sel.id); };
        chips.append(stop);
      }
      div.append(chips);
    }
  }

  // ---------- taps ----------
  function tap(sx, sy) {
    const w = screenToWorld(camera, sx, sy), k = pixelToHex(w.x, w.y, HEX_SIZE);
    if (!state.tiles[k]) return select(null);
    const seenUnit = visibleUnits(state, state.current).find(u => u.at === k);
    const me = sel?.kind === 'unit' ? state.units[sel.id] : null;
    const mine = me && me.owner === state.current;

    if (mine && view.heals.includes(seenUnit?.id)) {
      const ev = act({ type: 'heal', unitId: me.id, targetId: seenUnit.id });
      if (ev) select('unit', me.id);
      return;
    }
    if (mine && seenUnit && rams[seenUnit.id]) {
      // ram: first tap shows the run-up, second tap charges
      if (pending !== k) {
        pending = k; view.path = rams[seenUnit.id]; view.pathColor = '#ff3b30';
        info(); redraw(); toast('Nochmal tippen zum Rammen');
        return;
      }
      $('toast').classList.remove('show');
      const ev = act({ type: 'ram', unitId: me.id, path: rams[seenUnit.id] });
      if (ev && state.winner === null) select(state.units[me.id] ? 'unit' : null, me.id);
      return;
    }
    if (mine && seenUnit && view.targets.includes(seenUnit.id)) {
      const ev = act({ type: 'attack', unitId: me.id, targetId: seenUnit.id });
      if (ev) select(state.units[me.id] ? 'unit' : null, me.id);
      return;
    }
    if (mine && view.reach.includes(k)) {
      if (pending !== k) {
        pending = k; view.pathColor = null;
        view.path = reachable(state, me.id)[k];
        info(); redraw(); toast('Nochmal tippen zum Bewegen');
        return;
      }
      const path = reachable(state, me.id)[k];
      $('toast').classList.remove('show');
      const ev = act({ type: 'move', unitId: me.id, path });
      if (ev && state.winner === null) select('unit', me.id);
      return;
    }
    // second tap on a selected unit standing on a facility switches to the facility
    if (seenUnit && !(sel?.kind === 'unit' && sel.id === seenUnit.id && state.facilities[k])) return select('unit', seenUnit.id);
    if (state.facilities[k] && state.explored[state.current][k]) return select('facility', k);
    select(null);
  }

  // ---------- turn flow ----------
  function focusCurrent() {
    const pid = state.current;
    const u = Object.values(state.units).find(x => x.owner === pid);
    const at = u?.at ?? Object.keys(state.facilities).find(k => state.facilities[k].owner === pid);
    if (!at) return;
    const [c, r] = parseKey(at), p = hexToPixel(c, r, HEX_SIZE);
    centerOn(camera, p.x, p.y, canvas.clientWidth, canvas.clientHeight);
  }

  function handoff() {
    sel = null; pending = null;
    const p = state.players[state.current];
    $('handoff').style.background = p.color;
    $('handoff-name').textContent = p.name;
    $('handoff-round').textContent = state.round;
    $('handoff-note').textContent = eliminatedNote; eliminatedNote = '';
    clearTimeout(toast.timer); $('toast').classList.remove('show');
    view.viewer = state.current; view.state = null;  // never draw the map behind the hand-over
    renderer.draw({ ...view, state: null });
    show('handoff');
  }

  function beginTurn() {
    show('game');
    const p = state.players[state.current];
    $('hud-dot').style.background = p.color;
    $('hud-name').textContent = p.name;
    $('hud-round').textContent = state.round;
    focusCurrent();
    select(null);
  }

  function victory() {
    clearGame();
    detach?.();
    $('victory-name').textContent = state.players[state.winner].name;
    renderer.draw({ ...view, state, viewer: null, reach: [], targets: [], selected: null });
    show('victory');
  }

  $('handoff').onclick = beginTurn;
  $('hud-next').onclick = nextUnit;
  $('hud-end').onclick = () => {
    const ev = act({ type: 'endTurn' });
    if (ev && state.winner === null) handoff();
  };
  $('hud-menu').onclick = () => {
    const d = $('menu-dialog'), body = $('menu-body');
    body.innerHTML = '';
    const btn = (label, fn, alt) => { const b = document.createElement('button'); b.className = 'btn' + (alt ? ' alt' : ''); b.textContent = label; b.onclick = () => { d.close(); fn(); }; body.append(b); };
    btn('Weiterspielen', () => {});
    btn('Zum Hauptmenü (Spiel bleibt gespeichert)', () => { detach?.(); onExit(); }, true);
    btn('Spiel aufgeben und löschen', () => { if (confirm('Spiel wirklich löschen?')) { clearGame(); detach?.(); onExit(); } }, true);
    d.showModal();
  };

  detach = attachInput(canvas, {
    onTap: (x, y) => { if (document.querySelector('[data-screen="game"].active')) tap(x, y); },
    onPan: (dx, dy) => { camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom; redraw(); },
    onZoom: (f, x, y) => { zoomAt(camera, f, x, y); redraw(); },
  });

  // ponytail: test hook for scripted browser checks, only with ?debug
  if (location.search.includes('debug')) window.__sbi = {
    get state() { return state; }, view,
    screenOf: k => { const [c, r] = parseKey(k), p = hexToPixel(c, r, HEX_SIZE); return [(p.x - camera.x) * camera.zoom, (p.y - camera.y) * camera.zoom + canvas.getBoundingClientRect().top]; },
  };

  handoff();
}
