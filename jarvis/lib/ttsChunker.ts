// lib/ttsChunker.ts
// Chrome speechSynthesis는 긴 utterance(~15s/~200자)에서 잘린다.
// 문장 단위로 쪼개고, 그래도 긴 문장은 하드 분할한다.
export function chunkText(text: string, maxLen = 180): string[] {
  if (!text.trim()) return [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]?/g) ?? [text];
  const chunks: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLen) {
      for (let i = 0; i < trimmed.length; i += maxLen) {
        const part = trimmed.slice(i, i + maxLen).trim();
        if (part) chunks.push(part);
      }
    } else {
      chunks.push(trimmed);
    }
  }
  return chunks.filter(Boolean);
}
