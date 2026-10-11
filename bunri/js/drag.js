// 카드 끌기·톡(Pointer Events) · 수거함 하이라이트
const TAP_MOVE = 8;   // px 미만 움직임
const TAP_TIME = 300; // ms 미만이면 톡

export function binAt(x, y) {
  for (const n of document.elementsFromPoint(x, y)) {
    const b = n.closest && n.closest('.bin');
    if (b && !b.disabled) return b;
  }
  return null;
}

let hover = null;
function setHover(b) {
  if (b === hover) return;
  if (hover) hover.classList.remove('is-hover');
  hover = b;
  if (hover) hover.classList.add('is-hover');
}

/**
 * h = { canTouch(), canDrag(), onDragStart(), onMove(dx, dy), onDrop(binEl), onCancel(), onTap() }
 */
export function makeDraggable(node, h) {
  let pid = null;
  let sx = 0, sy = 0, t0 = 0, dx = 0, dy = 0, maxMove = 0, raf = 0;
  let dragging = false;

  const paint = () => { raf = 0; h.onMove(dx, dy); };

  node.addEventListener('pointerdown', (e) => {
    if (pid !== null || e.button > 0 || !h.canTouch()) return;
    pid = e.pointerId;
    sx = e.clientX; sy = e.clientY; t0 = performance.now();
    dx = 0; dy = 0; maxMove = 0; dragging = false;
    try { node.setPointerCapture(pid); } catch { /* 무시 */ }
    e.preventDefault();
  });

  node.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    maxMove = Math.max(maxMove, Math.hypot(dx, dy));
    if (!dragging && maxMove >= TAP_MOVE && h.canDrag()) { dragging = true; h.onDragStart(); }
    if (dragging) {
      if (!raf) raf = requestAnimationFrame(paint);
      setHover(binAt(e.clientX, e.clientY));
    }
    e.preventDefault();
  });

  const end = (e, dropped) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (dragging) {
      dragging = false;
      h.onMove(dx, dy);
      const target = dropped ? binAt(e.clientX, e.clientY) : null;
      setHover(null);
      if (target) h.onDrop(target);
      else h.onCancel();
    } else if (dropped && maxMove < TAP_MOVE && performance.now() - t0 < TAP_TIME) {
      h.onTap();
    }
  };
  node.addEventListener('pointerup', (e) => end(e, true));
  node.addEventListener('pointercancel', (e) => end(e, false));
  // 끄는 동안 페이지 스크롤 방지(iOS)
  node.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}
