// lib/sentenceBuffer.ts
// 스트리밍 텍스트 델타를 모아 완성 문장 단위로 방출한다.
const ENDERS = /[.!?。！？]/;

export function createSentenceBuffer() {
  let buf = "";
  return {
    feed(delta: string): string[] {
      buf += delta;
      const out: string[] = [];
      let m: RegExpExecArray | null;
      // 종결부호 위치까지 잘라 방출 (부호 포함)
      while ((m = ENDERS.exec(buf)) !== null) {
        const end = m.index + 1;
        const sentence = buf.slice(0, end).trim();
        if (sentence) out.push(sentence);
        buf = buf.slice(end);
      }
      return out;
    },
    flush(): string {
      const rest = buf.trim();
      buf = "";
      return rest;
    },
  };
}
