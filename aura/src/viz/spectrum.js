// 레이어 A: 발광 멤브레인 링 + 절제된 광선 코로나(테이퍼드 삼각형) + 코어.
// 블룸 버퍼에 그려지므로 shadowBlur 불필요.
const MAJOR = 56;
let smooth = null;

function ray(ctx, a, r0, len, width, hue, sat, alpha, m) {
  const c = Math.cos(a), s = Math.sin(a);
  const bx = c * r0, by = s * r0;
  const tx = c * (r0 + len), ty = s * (r0 + len);
  const px = -s, py = c, hw = width / 2;
  const g = ctx.createLinearGradient(bx, by, tx, ty);
  g.addColorStop(0, `hsla(${hue} ${sat}% 66% / ${alpha * (0.45 + m * 0.55)})`);
  g.addColorStop(0.22, `hsla(${hue} ${sat}% 72% / ${alpha * (0.5 + m * 0.5)})`);
  g.addColorStop(1, `hsla(${hue} ${sat}% 64% / 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx + px * hw, by + py * hw);
  ctx.lineTo(bx - px * hw, by - py * hw);
  ctx.lineTo(tx, ty);
  ctx.closePath();
  ctx.fill();
}

export function drawSpectrum(ctx, w, h, frame) {
  const { level, spectrum, palette, t } = frame;
  const cx = w / 2, cy = h / 2;
  const base = Math.min(w, h) * 0.15;
  if (!smooth || smooth.length !== MAJOR) smooth = new Float32Array(MAJOR);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.035);

  // 발광 멤브레인 링 2겹.
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
    ctx.strokeStyle = `hsla(${palette.h + r * 14} ${palette.sat}% ${palette.light + 6}% / ${0.42 + level * 0.4})`;
    ctx.lineWidth = 1.4 + level * 1.8;
    ctx.stroke();
  }

  // 광선 코로나: 절제된 단일 레이어. 여백을 두어 우아하게, 강한 빈만 길게 솟구침.
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
    const hue = palette.h + (i / MAJOR) * 36 - 18;
    ray(ctx, a, r0, base * (0.35 + (m + flare) * 1.7) * (0.85 + level * 0.5), 2.0 + m * 2.6, hue, palette.sat, 0.85, m);
  }

  // 코어 — 흰색 포화 없이 색을 머금은 소프트 펄스.
  const cr = base * (0.22 + level * 0.34);
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
  cg.addColorStop(0, `hsla(${palette.h} ${palette.sat}% 60% / ${0.18 + level * 0.22})`);
  cg.addColorStop(1, `hsla(${palette.h} ${palette.sat}% 52% / 0)`);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, cr, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
