// 디자인 토큰(CSS 변수) → RGB 배열. 캔버스 색은 전부 토큰에서 읽는다(하드코딩 금지).
// 어떤 CSS 색 문자열이든 1×1 캔버스에 칠해 픽셀을 읽는 방식이라 hex·rgb·color() 모두 처리.
let probe = null;

function probeCtx() {
  if (probe) return probe;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  probe = c.getContext('2d', { willReadFrequently: true });
  return probe;
}

export function token(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const p = probeCtx();
  p.clearRect(0, 0, 1, 1);
  p.fillStyle = v || 'transparent';
  p.fillRect(0, 0, 1, 1);
  const d = p.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

export function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function rgba(c, alpha) {
  const al = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al.toFixed(3)})`;
}
