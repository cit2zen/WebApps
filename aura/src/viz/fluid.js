// 레이어 B: 컬러 포그. 가산이 아닌 source-over 알파 블렌딩 + 중심을 비운 링 궤도 →
// 중심이 흰색으로 포화되지 않고, 색을 머금은 오로라 로브가 천천히 회전한다.
const BLOBS = [
  { ang: 0.0, sp: 0.45, ph: 0.0 },
  { ang: 2.1, sp: -0.38, ph: 1.5 },
  { ang: 4.2, sp: 0.40, ph: 3.0 },
  { ang: 1.0, sp: -0.52, ph: 4.6 },
];

export function drawFluid(ctx, w, h, frame) {
  const { level, palette, t } = frame;
  const cx = w / 2, cy = h / 2;
  const unit = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over'; // 색 블렌딩(가산 아님)
  const ringR = unit * (0.11 + level * 0.10);
  BLOBS.forEach((b, i) => {
    const ang = b.ang + t * b.sp;
    const x = cx + Math.cos(ang) * ringR + Math.sin(t * 0.7 + b.ph) * unit * 0.045;
    const y = cy + Math.sin(ang) * ringR * 0.82 + Math.cos(t * 0.6 + b.ph) * unit * 0.04;
    const r = unit * (0.18 + level * 0.13) + Math.sin(t * 1.4 + b.ph) * unit * 0.03;
    const hue = palette.h2 + Math.sin(t * 0.4 + i) * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue} ${palette.sat}% ${palette.light + 4}% / ${0.26 + level * 0.12})`);
    g.addColorStop(0.6, `hsla(${hue + 12} ${palette.sat}% ${palette.light - 4}% / ${0.10 + level * 0.06})`);
    g.addColorStop(1, `hsla(${hue} ${palette.sat}% ${palette.light - 10}% / 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
