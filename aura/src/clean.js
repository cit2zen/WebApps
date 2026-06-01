// clean.js — TTS가 마크다운 기호(**굵게**, `코드`, # 제목 등)와 이모지(☀️ 등)를
// 글자 그대로 읽는 문제를 막는다. 발화 직전 텍스트를 정제한다.
// stripMarkdown: 자막 표시용(이모지 유지). cleanForSpeech: 발화용(이모지까지 제거).

export function stripMarkdown(input) {
  let s = String(input ?? "");
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s*([-*+]|\d+\.)\s+/gm, "");
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/(\*|_)(.*?)\1/g, "$2");
  s = s.replace(/~~(.*?)~~/g, "$1");
  s = s.replace(/^\s*([-*_]\s*){3,}$/gm, " ");
  s = s.replace(/[*_`~#>|]/g, "");
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n").trim();
}

export function cleanForSpeech(input) {
  let s = stripMarkdown(input);
  s = s
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "");
  return s.replace(/\s{2,}/g, " ").trim();
}
