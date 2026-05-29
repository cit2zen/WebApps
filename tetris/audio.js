// audio.js — Web Audio synth: procedural SFX + chiptune BGM (Korobeiniki, public domain)
// No external assets. Scheduler is driven by tick() from the main rAF loop (no setInterval).

const SEMI = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
function freq(name) {
  if (!name) return 0;
  const m = /^([A-G]#?)(\d)$/.exec(name);
  return 440 * Math.pow(2, (SEMI[m[1]] + (Number(m[2]) - 4) * 12) / 12);
}

const BPM = 150;
const BEAT = 60 / BPM;

// [note, beats] — null = rest. Korobeiniki A-theme, 32 beats.
const MELODY = [
  ['E5', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 0.5], ['B4', 0.5],
  ['A4', 1], ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
  [null, 0.5], ['D5', 1], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5],
  ['E5', 1.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1],
  ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
];
// half-note bass, 32 beats.
const BASS = [
  ['E2', 2], ['B2', 2], ['A2', 2], ['E2', 2],
  ['G#2', 2], ['E2', 2], ['A2', 2], ['E2', 2],
  ['D3', 2], ['A2', 2], ['C3', 2], ['G2', 2],
  ['B2', 2], ['B2', 2], ['A2', 2], ['E2', 2],
];

function buildEvents(seq, type, vol) {
  let t = 0;
  const ev = [];
  for (const [n, b] of seq) {
    if (n) ev.push({ t, dur: b * BEAT * 0.92, n, type, vol });
    t += b * BEAT;
  }
  return ev;
}
const LOOP_LEN = 32 * BEAT;
const EVENTS = [...buildEvents(MELODY, 'square', 0.5), ...buildEvents(BASS, 'triangle', 0.35)]
  .sort((a, b) => a.t - b.t);

export function createAudio() {
  let ctx, master, musicGain, sfxGain;
  let muted = false;
  let playing = false;
  let loopStart = 0, idx = 0, cycle = 0;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
  }

  function tone(dest, f, start, dur, type, vol) {
    if (!f) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    o.connect(g); g.connect(dest);
    const atk = 0.006, rel = Math.min(0.07, dur * 0.5);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + atk);
    g.gain.setValueAtTime(vol, start + dur - rel);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start); o.stop(start + dur + 0.02);
  }

  // short percussive effect: glide from f0->f1
  function blip(f0, f1, dur, type = 'square', vol = 0.5) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), ctx.currentTime + dur);
    o.connect(g); g.connect(sfxGain);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function arp(notes, step, type = 'square', vol = 0.5) {
    if (!ctx) return;
    notes.forEach((f, i) => tone(sfxGain, f, ctx.currentTime + i * step, step * 1.6, type, vol));
  }

  const sfxMap = {
    move: () => blip(180, 180, 0.04, 'square', 0.28),
    rotate: () => blip(320, 440, 0.06, 'square', 0.32),
    hold: () => blip(520, 700, 0.08, 'triangle', 0.4),
    harddrop: () => blip(420, 70, 0.12, 'sawtooth', 0.4),
    levelup: () => arp([freq('C5'), freq('E5'), freq('G5'), freq('C6')], 0.07, 'square', 0.45),
    gameover: () => blip(440, 55, 0.9, 'sawtooth', 0.5),
    tspin: () => arp([freq('A4'), freq('D5'), freq('F5'), freq('A5')], 0.05, 'triangle', 0.5),
  };

  function clearSfx(n) {
    if (n >= 4) arp([freq('C5'), freq('G5'), freq('C6'), freq('E6'), freq('G6')], 0.06, 'square', 0.5);
    else arp([freq('C5'), freq('E5'), freq('G5')].slice(0, n + 1), 0.05, 'square', 0.42);
  }

  return {
    unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); },
    startMusic() {
      this.unlock();
      if (playing) return;
      playing = true;
      loopStart = ctx.currentTime + 0.15;
      idx = 0; cycle = 0;
    },
    // called every frame from the game loop — schedules notes ~0.15s ahead
    tick() {
      if (!playing || !ctx) return;
      const horizon = ctx.currentTime + 0.15;
      while (true) {
        const e = EVENTS[idx];
        const at = loopStart + cycle * LOOP_LEN + e.t;
        if (at >= horizon) break;
        tone(musicGain, freq(e.n), at, e.dur, e.type, e.vol);
        if (++idx >= EVENTS.length) { idx = 0; cycle++; }
      }
    },
    sfx(name, arg) {
      if (!ctx) return;
      if (name === 'clear') clearSfx(arg);
      else if (sfxMap[name]) sfxMap[name]();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() { return muted; },
    // v in 0..1
    setSfxVolume(v) { ensure(); sfxGain.gain.setTargetAtTime(v * 0.85, ctx.currentTime, 0.02); },
    setMusicVolume(v) { ensure(); musicGain.gain.setTargetAtTime(v * 0.32, ctx.currentTime, 0.02); },
  };
}
