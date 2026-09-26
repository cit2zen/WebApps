// camera.js — §4 스케일·스폰·카메라 식, world↔screen 변환, 가로 폰 판정. DOM 없음(창 크기는 인자로 받는다).
export const WORLD_W = 390;
export const BAR = 150;               // 하단 버튼 바 css px
export const SPAWN_GAP = 180;         // 스폰 = 탑 최고점 + 180
export const LANDSCAPE_K = 0.75;

// w, h = innerWidth, innerHeight(css px), safeTop = env(safe-area-inset-top) px
export function layout(w, h, safeTop = 0) {
  const k = Math.min(w / WORLD_W, 1.5, (h - 256 - safeTop) / 237.5);
  return {
    w, h, safeTop, k,
    Hv: h / k,
    R: (h - BAR) / k,
    S: Math.max(0.25 * h, safeTop + 106 + 57.5 * k),
    ox: (w - WORLD_W * k) / 2,
    rockScreenY: h - BAR,
    landscape: k < LANDSCAPE_K,
  };
}

// camOff 목표값 = max(0, Y − (R − 180 − S/k)). Y = 연결 탑 최고점(월드 px).
export const camTarget = (L, Y) => Math.max(0, Y - (L.R - SPAWN_GAP - L.S / L.k));

export function createCamera(L) {
  const cam = {
    L, Y: 0, camOff: 0, target: 0,
    setLayout(nl) { cam.L = nl; cam.target = camTarget(nl, cam.Y); },
    setHeight(Y) { cam.Y = Y; cam.target = camTarget(cam.L, Y); },
    track(dt) { cam.camOff += (cam.target - cam.camOff) * (1 - Math.exp(-4 * dt)); return cam.camOff; },
    snap() { cam.camOff = cam.target; return cam.camOff; },
    toScreen(x, y) { const { ox, k, h } = cam.L; return [ox + x * k, (h - BAR) - (y - cam.camOff) * k]; },
    toWorld(sx, sy) { const { ox, k, h } = cam.L; return [(sx - ox) / k, ((h - BAR) - sy) / k + cam.camOff]; },
  };
  return cam;
}
