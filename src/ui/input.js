// Pointer gestures: tap, one-finger drag (pan or paint), two-finger pan + pinch, wheel zoom.
export function attachInput(canvas, { onTap, onPan, onZoom, onPaint, mode = () => 'pan' }) {
  const pts = new Map();
  let start = null, moved = false, pinch = null;

  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };

  function down(e) {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, pos(e));
    if (pts.size === 1) { start = pos(e); moved = false; if (mode() === 'paint') onPaint?.(start.x, start.y); }
    if (pts.size === 2) { pinch = mid(); moved = true; }
  }
  function move(e) {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), p = pos(e);
    pts.set(e.pointerId, p);
    if (pts.size >= 2) {
      const m = mid();
      onPan(m.x - pinch.x, m.y - pinch.y);
      if (pinch.d > 0) onZoom(m.d / pinch.d, m.x, m.y);
      pinch = m;
      return;
    }
    if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < 8) return;
    moved = true;
    if (mode() === 'paint') onPaint?.(p.x, p.y);
    else onPan(p.x - prev.x, p.y - prev.y);
  }
  function up(e) {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size === 0 && !moved) onTap(p.x, p.y);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { start = [...pts.values()][0]; }
  }
  function wheel(e) { e.preventDefault(); const p = pos(e); onZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('wheel', wheel);
  };
}
