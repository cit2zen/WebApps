// 배경 음악 악보 — 16분음표 칸(step) 단위. 음 이름 → MIDI 번호
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' 'F#3' 'Bb4' → MIDI, '.' → null */
export function midi(tok) {
  if (!tok || tok === '.' || tok === '-') return null;
  const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const hz = (n) => 440 * 2 ** ((n - 69) / 12);

/** 한 마디 8분음표 8칸 문자열 → [step, midi, 길이(step)] 목록 ('-'는 앞 음 늘이기) */
function bar8(str) {
  const toks = str.trim().split(/\s+/);
  const out = [];
  toks.forEach((t, i) => {
    if (t === '-' && out.length) { out[out.length - 1][2] += 2; return; }
    const n = midi(t);
    if (n != null) out.push([i * 2, n, 2]);
  });
  return out;
}

// 메뉴 — 잔잔한 92 BPM 8마디 (C · Am · F · G · C · Am · Dm · G)
export const MENU = {
  bpm: 92,
  roots: ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'D3', 'G2'].map(midi),
  lead: [
    'E5 - G5 - E5 D5 C5 -',
    'C5 - E5 - A4 - - .',
    'F4 A4 C5 - A4 - F4 .',
    'G4 - B4 D5 - - . .',
    'E5 - G5 - C6 - G5 E5',
    'A5 - G5 E5 C5 - - .',
    'D5 F5 A5 - F5 D5 - .',
    'B4 - D5 - G4 - - .',
  ].map(bar8),
  wave: 'triangle',
  leadVol: 0.32,
  bassVol: 0.45,
  // 타악 패턴 16칸: k 킥 · s 스네어(약) · h 하이햇
  drums: 'k...h...s...h...',
};

// 플레이 — 신나는 120 BPM 8마디 (C · G · Am · F ×2, 둘째 줄은 변주)
export const PLAY = {
  bpm: 120,
  roots: ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'A2', 'F2'].map(midi),
  lead: [
    'C5 E5 G5 E5 C6 - G5 E5',
    'D5 G5 B5 G5 D6 - B5 G5',
    'C5 E5 A5 E5 C6 - A5 E5',
    'C5 F5 A5 F5 C6 - A5 G5',
    'E5 - G5 - C6 B5 A5 G5',
    'D5 - G5 - B5 A5 G5 D5',
    'E5 - A5 - C6 B5 A5 E5',
    'F5 - A5 - G5 - - .',
  ].map(bar8),
  wave: 'square',
  leadVol: 0.18,
  bassVol: 0.5,
  drums: 'k.h.s.h.k.hks.h.',
  hot: 'hhhhhhhhhhhhhhhh', // 피버·러시 — 하이햇 두 배
};

// 결과 징글 — [시작(박), MIDI, 길이(박)]
export const JINGLE = {
  success: { bpm: 132, notes: [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 0.5], [1.5, 'C6', 1.5], [1.5, 'E5', 1.5], [1.5, 'G4', 1.5]] },
  fail: { bpm: 96, notes: [[0, 'G4', 0.75], [0.75, 'E4', 0.75], [1.5, 'D4', 0.75], [2.25, 'C4', 1.5], [2.25, 'G3', 1.5]] },
};
