/** 제어문자 제거 + 길이 제한 — 프롬프트 인젝션/과대입력 방어 (평가자 공통) */
export function sanitize(s: string, max = 400): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 0x20 ? ' ' : ch;
  }
  return out.slice(0, max);
}
