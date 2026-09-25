// 레이어 A: 멤브레인 링(잉크 선) + 절제된 광선 코로나(테이퍼드 삼각형) + 코어.
// 워시 버퍼에 일반 합성으로 그려진다(가산 없음).
import { mix, rgba } from './color.js';

const MAJOR = 56;
let smooth = null;

function ray(ctx, a, r0, len, width, col, alpha, m) {
  const c = Math.cos(a), s = Math.sin(a);
  const bx = c * r0, by = s * r0;
  const tx = c * (r0 + len), ty = s * (r0 + len);
  const px = -s, py = c, hw = width / 2;
  const g = ctx.createLinearGradient(bx, by, tx, ty);
  g.addColorStop(0, rgba(col, alpha * (0.35 + m * 0.45)));
  g.addColorStop(0.22, rgba(col, alpha * (0.42 + m * 0.4)));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx + px * hw, by + py * hw);
  ctx.lineTo(bx - px * hw, by - py * hw);
  ctx.lineTo(tx, ty);
  ctx.closePath();
  ctx.fill();
}

export function drawSpectrum(layers, w, h, frame) {
  const { level, spectrum, palette, t, op } = frame;
  const { wash, trail } = layers;
  const cx = w / 2, cy = h / 2;
  const base = Math.min(w, h) * 0.15;
  if (!smooth || smooth.length !== MAJOR) smooth = new Float32Array(MAJOR);

  for (const c of [wash, trail]) {
    c.save();
    c.translate(cx, cy);
    c.rotate(t * 0.035);
  }

  // 멤브레인 링 2겹(trail — 잔상이 겹겹이) — 안쪽은 강조색, 바깥은 잉크 쪽으로.
  let ctx = trail;
  for (let r = 0; r < 2; r++) {
    const r0 = base * (1 + r * 0.5) + level * base * 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const wob = Math.sin(a * 5 + t * 1.6 + r * 1.3) * level * base * 0.35
                + Math.sin(a * 11 - t * 2.2) * level * base * 0.12;
      const rr = r0 + wob, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(mix(palette.a, palette.ink, 0.15 + r * 0.3), op(0.5 + level * 0.35));
    ctx.lineWidth = 1.2 + level * 1.6;
    ctx.stroke();
  }

  // 광선 코로나(wash): 절제된 단일 레이어. 여백을 두어 우아하게, 강한 빈만 길게 솟구침.
  ctx = wash;
  const r0 = base * 1.95 + level * base * 0.5;
  for (let i = 0; i < MAJOR; i++) {
    const a = (i / MAJOR) * Math.PI * 2;
    let mag;
    if (spectrum) {
      const idx = Math.floor((i / MAJOR) * (spectrum.length * 0.55));
      mag = spectrum[idx] / 255;
    } else {
      mag = 0.14 + 0.4 * Math.abs(Math.sin(i * 0.7 + t * 1.4));
    }
    // 진행파 + 프레임간 스무딩 → 부드럽고 유기적인 광선 길이.
    const target = mag + 0.08 * Math.sin(i * 0.5 - t * 2.6);
    smooth[i] += (target - smooth[i]) * 0.2;
    const m = Math.max(0, smooth[i]);
    const flare = m > 0.7 ? (m - 0.7) * 2.2 : 0;
    const col = mix(palette.a, palette.b, 0.5 + 0.5 * Math.sin((i / MAJOR) * Math.PI * 2));
    ray(ctx, a, r0, base * (0.35 + (m + flare) * 1.7) * (0.85 + level * 0.5), 2.0 + m * 2.6, col, 0.6, m);
  }

  // 코어 — 강조색을 머금은 소프트 펄스.
  const cr = base * (0.22 + level * 0.34);
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
  cg.addColorStop(0, rgba(palette.a, 0.14 + level * 0.18));
  cg.addColorStop(1, rgba(palette.a, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, cr, 0, Math.PI * 2);
  ctx.fill();

  wash.restore();
  trail.restore();
}
