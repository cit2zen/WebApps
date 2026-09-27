// 조준 표본 버퍼·포인터 시간/영역 규칙(순수 함수, DOM 없음) — §6 입력 처리, 분할 예비안 aimbuf.js
export const X_MIN = 25, X_MAX = 365;
export const TAP_MS = 120, BACK_MS = 80, KEEP_MS = 300, BUF_MAX = 64;
export const BAR = 150, HINT = 40, WHEEL_MS = 80, REP_DELAY = 350, REP_EVERY = 150;

export const clampX = x => Math.min(X_MAX, Math.max(X_MIN, x));

// 표본 {t: e.timeStamp, x: 돌 월드 x(clamp 뒤)}. 가지치기는 push 때만, 마지막 1개는 항상 남긴다.
export function push(buf, t, x) {
  buf.push({ t, x });
  while (buf.length > 1 && buf[0].t < t - KEEP_MS) buf.shift();
  while (buf.length > BUF_MAX) buf.shift();
  return buf;
}

// 떼기 80ms 보정: t ≤ tUp−80 인 마지막 표본의 x, 없으면 buf[0].x
export function releaseX(buf, tUp) {
  let hit = null;
  for (const s of buf) if (s.t <= tUp - BACK_MS) hit = s;
  return (hit || buf[0]).x;
}

export const isShortTap = (tDown, tUp) => tUp - tDown < TAP_MS;
export const inBar = (y, ih) => y >= ih - BAR;
export const nearBar = (y, ih) => y >= ih - BAR - HINT && y < ih - BAR;
export const relX = (x0, dxCss, k) => clampX(x0 + dxCss / k);
export const absX = (clientX, ox, k) => clampX((clientX - ox) / k);

// 회전 버튼 홀드: 누른 뒤 350ms에 첫 반복, 이후 150ms마다. now까지 누적 반복 횟수
export const repeatDue = (t0, now) =>
  now - t0 < REP_DELAY ? 0 : Math.floor((now - t0 - REP_DELAY) / REP_EVERY) + 1;

export const wheelOk = (last, t) => t - last >= WHEEL_MS;
export const wheelDir = dy => (dy > 0 ? 1 : dy < 0 ? -1 : 0);
