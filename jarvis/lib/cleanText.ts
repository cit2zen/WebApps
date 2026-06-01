// lib/cleanText.ts
// TTS가 마크다운 기호(**굵게**, `코드`, # 제목, - 목록 등)와 이모지(☀️ 등)를
// 글자 그대로 읽어버리는 문제를 막는다. 발화 직전 텍스트를 정제한다.
// stripMarkdown: 화면 표시용(이모지 유지). cleanForSpeech: 발화용(이모지까지 제거).

// 마크다운 구조/기호 제거 — 텍스트 내용은 보존
export function stripMarkdown(input: string): string {
  let s = input;
  s = s.replace(/```[\s\S]*?```/g, " ");          // 코드 블록
  s = s.replace(/`([^`]+)`/g, "$1");               // 인라인 코드
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");  // 이미지 → alt
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");    // 링크 → 텍스트
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");         // 제목 #
  s = s.replace(/^\s{0,3}>\s?/gm, "");              // 인용 >
  s = s.replace(/^\s*([-*+]|\d+\.)\s+/gm, "");      // 목록 글머리
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");         // 굵게
  s = s.replace(/(\*|_)(.*?)\1/g, "$2");            // 기울임
  s = s.replace(/~~(.*?)~~/g, "$1");                // 취소선
  s = s.replace(/^\s*([-*_]\s*){3,}$/gm, " ");      // 수평선 ---
  s = s.replace(/[*_`~#>|]/g, "");                  // 남은 기호 제거
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n").trim();
}

// 발화용: 마크다운 제거 + 이모지/그림문자 제거
export function cleanForSpeech(input: string): string {
  let s = stripMarkdown(input);
  // 이모지·그림문자(☀️ 등) + 변형 선택자/ZWJ/스킨톤/지역표시 제거
  s = s
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "");
  return s.replace(/\s{2,}/g, " ").trim();
}
