// 음악 악기 — 짧은 오실레이터 음과 잡음 타악 (music.js에서 예약)
let noise = null;
function noiseBuf(ctx) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

export function voice(ctx, out, t, freq, dur, type, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function drum(ctx, out, t, kind) {
  if (kind === 'k') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    return;
  }
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noiseBuf(ctx);
  f.type = 'highpass';
  f.frequency.value = kind === 'h' ? 7000 : 1600;
  const len = kind === 'h' ? 0.035 : 0.12;
  g.gain.setValueAtTime(kind === 'h' ? 0.18 : 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5, len + 0.02);
}
