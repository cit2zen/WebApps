// Pointer Events 조준(마우스 절대·그 밖 상대)·120ms 탭 무시·80ms 떼기 보정·취소 존·
// pointercancel·회전 버튼 홀드·휠 스로틀 — §6 입력 처리. 순수 규칙은 aimbuf.js
import * as B from './aimbuf.js';

let stage = null, send = () => {}, onHint = () => {};
let getAim = () => ({ on: false, x: 195, k: 1, ox: 0 });
let aimT = Infinity;            // 현재 aim 진입 시각(performance.now 기준). 그 전에 눌린 포인터는 무시
let ptr = null, dragActive = false, hintOn = false;
let rot = null, lastWheel = -Infinity;

const ih = () => window.innerHeight;
function hint(on) { if (on !== hintOn) { hintOn = on; onHint(on); } }

// game이 core 'aim' 이벤트를 받는 즉시 호출. 이전 aim에서 시작된 드래그는 버린다
export function markAim(t) {
  aimT = t;
  ptr = null; dragActive = false; hint(false);
}

function cancel() {
  if (!ptr) return;
  const x0 = ptr.x0;
  ptr = null; dragActive = false; hint(false);
  send({ t: 'cancel', x: x0 });
}

function down(e) {
  if (!e.isPrimary || ptr) return;
  const mouse = e.pointerType === 'mouse';
  if (mouse && e.button !== 0) return;
  const a = getAim();
  if (!a.on || e.timeStamp < aimT || B.inBar(e.clientY, ih())) return;
  try { stage.setPointerCapture(e.pointerId); } catch { /* 합성 포인터 */ }
  dragActive = true;
  ptr = { id: e.pointerId, mouse, tDown: e.timeStamp, cx: e.clientX, x0: a.x, buf: B.push([], e.timeStamp, a.x) };
}

function move(e) {
  const a = getAim();
  if (!ptr) {
    if (e.pointerType === 'mouse' && a.on && !B.inBar(e.clientY, ih())) {
      send({ t: 'setX', x: B.absX(e.clientX, a.ox, a.k) });
    }
    return;
  }
  if (e.pointerId !== ptr.id) return;
  if (B.inBar(e.clientY, ih())) { cancel(); return; }
  hint(B.nearBar(e.clientY, ih()));
  if (ptr.mouse) { send({ t: 'setX', x: B.absX(e.clientX, a.ox, a.k) }); return; }
  const co = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  let x = ptr.x0;
  for (const ev of co.length ? co : [e]) {
    x = B.relX(ptr.x0, ev.clientX - ptr.cx, a.k);
    B.push(ptr.buf, ev.timeStamp, x);
  }
  send({ t: 'setX', x });
}

function up(e) {
  dragActive = false;
  if (!ptr || e.pointerId !== ptr.id) return;
  if (B.inBar(e.clientY, ih())) { cancel(); return; }
  const p = ptr;
  ptr = null; hint(false);
  const a = getAim();
  if (!a.on) return;
  if (p.mouse) {
    send({ t: 'setX', x: B.absX(e.clientX, a.ox, a.k) });
  } else {
    if (B.isShortTap(p.tDown, e.timeStamp)) return;
    send({ t: 'setX', x: B.releaseX(p.buf, e.timeStamp) });
  }
  send({ t: 'drop' });
}

function onCancel(e) { if (ptr && e.pointerId === ptr.id) cancel(); }
function onLost(e) { if (dragActive && ptr && e.pointerId === ptr.id) cancel(); }

function wheel(e) {
  e.preventDefault();
  const d = B.wheelDir(e.deltaY);
  if (!d || !B.wheelOk(lastWheel, e.timeStamp)) return;
  lastWheel = e.timeStamp;
  send({ t: 'rot', d });
}

function bindRot(btn, d) {
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();                        // 포커스를 받지 않는다
    if (!e.isPrimary) return;
    rot = { d, t0: e.timeStamp, n: 0 };
    send({ t: 'rot', d });
  });
  const stop = () => { rot = null; };
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(type, stop);
}

// main의 rAF 루프가 매 프레임 호출: 회전 버튼 홀드 반복(350ms 후 150ms)
export function poll(now) {
  if (!rot) return;
  const due = B.repeatDue(rot.t0, now);
  while (rot && rot.n < due) { rot.n++; send({ t: 'rot', d: rot.d }); }
}

// opts = {stage, rotCw, rotCcw, onAction(a), getAim() → {on, x, k, ox}, onHint(bool)}
export function init(opts) {
  stage = opts.stage; send = opts.onAction; getAim = opts.getAim;
  if (opts.onHint) onHint = opts.onHint;
  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', onCancel);
  stage.addEventListener('lostpointercapture', onLost);
  stage.addEventListener('wheel', wheel, { passive: false });
  bindRot(opts.rotCw, 1);
  bindRot(opts.rotCcw, -1);
}
