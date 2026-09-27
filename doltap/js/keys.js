// 키보드: mapKey(상태·포커스 규칙) + 좌우 키 가속 상태 — §6 입력 처리 키보드 표
export const PLAY = new Set(['aim', 'drop', 'settle', 'hold']);
const ACT = new Set(['Space', 'Enter', 'NumpadEnter']);
const DROP = new Set(['Space', 'ArrowDown', 'Enter', 'NumpadEnter']);
const LEFT = new Set(['ArrowLeft', 'KeyA']), RIGHT = new Set(['ArrowRight', 'KeyD']);
const ROT_GAP = 150;

// env = {state, dialog: null|'S9'|기타 대화상자 id, focus: 'body'|'textarea'|'other'}
export function mapKey(e, env) {
  const { state, dialog = null, focus = 'body' } = env;
  if (e.isComposing || focus === 'textarea') return null;
  const c = e.code, down = e.type === 'keydown';
  if (dialog) {
    if (!down) return null;
    if (c === 'Escape') return { t: 'closeTop' };
    if (c === 'KeyP' && dialog === 'S9') return { t: 'resume' };
    return null;
  }
  if (PLAY.has(state)) {
    if (LEFT.has(c)) return { t: 'moveKey', dir: -1, down };
    if (RIGHT.has(c)) return { t: 'moveKey', dir: 1, down };
    if (!down) return null;
    if (c === 'ArrowUp' || c === 'KeyX') return { t: 'rot', d: 1 };
    if (c === 'KeyZ') return { t: 'rot', d: -1 };
    if (DROP.has(c)) return e.repeat ? null : { t: 'drop' };
    if (c === 'Backspace') return { t: 'cancel', x: 195 };
    if (c === 'KeyQ') return e.repeat ? null : { t: 'skipTap', at: e.timeStamp };
    if (c === 'KeyP' || c === 'Escape') return e.repeat ? null : { t: 'pause' };
    if (c === 'KeyM') return e.repeat ? null : { t: 'mute' };
    return null;
  }
  if (!down || e.repeat) return null;
  if (c === 'KeyM' && (state === 'paused' || state === 'lobby' || state === 'result')) return { t: 'mute' };
  if (state === 'paused') return c === 'KeyP' || c === 'Escape' ? { t: 'resume' } : null;
  if (state === 'lobby') return c === 'Enter' && focus === 'body' ? { t: 'today' } : null;
  if (state === 'result') return c === 'KeyS' ? { t: 'share' } : c === 'KeyR' ? { t: 'retry' } : null;
  return null;
}

// 좌우 키 가속: 누른 뒤 150ms부터 120px/s, +480px/s², 최대 360px/s (s = 누른 시간 초)
export const keySpeed = s => (s < 0.15 ? 0 : Math.min(360, 120 + 480 * (s - 0.15)));

let getEnv = () => ({ state: 'boot' }), send = () => {}, lastRot = -Infinity;
const held = new Map(); // dir → 누른 시간(초)

function focusOf() {
  const d = globalThis.document;
  const el = d && d.activeElement;
  if (!el || el === d.body) return 'body';
  return el.tagName === 'TEXTAREA' ? 'textarea' : 'other';
}

export function onKey(e) {
  // 좌우 키를 떼면 상태·대화상자와 무관하게 누름 상태를 비운다(일시정지 중 뗀 키가 재개 뒤 계속 미는 것 방지)
  if (e.type === 'keyup') held.delete(LEFT.has(e.code) ? -1 : RIGHT.has(e.code) ? 1 : 0);
  const env = { focus: focusOf(), ...getEnv() };
  const a = mapKey(e, env);
  if (a) {
    if (a.t === 'moveKey') {
      if (!a.down) held.delete(a.dir);
      else if (!e.repeat) { held.set(a.dir, 0); send({ t: 'move', dx: 2 * a.dir }); }
    } else if (a.t === 'rot' && e.repeat && e.timeStamp - lastRot < ROT_GAP) {
      // auto-repeat 150ms 간격 제한
    } else {
      if (a.t === 'rot') lastRot = e.timeStamp;
      send(a);
    }
  }
  if (PLAY.has(env.state) && !env.dialog && (a || ACT.has(e.code))) e.preventDefault();
}

export function poll(dt) {
  let dx = 0;
  for (const [dir, s] of held) {
    const s2 = s + dt;
    held.set(dir, s2);
    dx += dir * keySpeed(s2) * dt;
  }
  if (dx) send({ t: 'move', dx });
}

export const clearHeld = () => held.clear();

// target=null이면 리스너 없이 상태만 초기화(Node 테스트용)
export function init({ getEnv: g, onAction, target = globalThis.window }) {
  getEnv = g; send = onAction; lastRot = -Infinity; held.clear();
  if (!target) return;
  target.addEventListener('keydown', onKey, { capture: true });
  target.addEventListener('keyup', onKey, { capture: true });
  target.addEventListener('blur', clearHeld);
}
