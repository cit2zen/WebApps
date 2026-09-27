// js/debug_hash.js — §5 해시 규칙(sha-256, crypto.subtle). debug.js 분할 예비안(§6)을 1단계부터 적용
import { daily, addDays } from './daily.js';

// 돌 1개 = "type,attempts,tone,moss,verts"(verts는 JSON.stringify). cx·cy는 넣지 않는다
export const stoneLine = st => `${st.type},${st.attempts},${st.tone},${st.moss},${JSON.stringify(st.verts)}`;

export async function hashSet(set) {
  const text = set.stones.map(stoneLine).join('\n');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashDay(day) { return hashSet(daily(day)); }

// [{day, hash, r0:[24], r:[24], s:[24]}] — tools/ref_stones.py 출력(ref.json)과 같은 모양
export async function hashRange(from, days) {
  const out = [];
  for (let k = 0; k < days; k++) {
    const day = addDays(from, k), set = daily(day);
    out.push({ day, hash: await hashSet(set), r0: set.stones.map(s => s.r0),
      r: set.stones.map(s => s.r), s: set.stones.map(s => s.s) });
  }
  return out;
}
