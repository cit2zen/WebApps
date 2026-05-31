// lib/sentenceBuffer.ts
// 스트리밍 텍스트 델타를 모아 완성 문장 단위로 방출한다.
// 한국어 STT/응답은 마침표 없이 줄바꿈·어미로 끝나는 경우가 많아, 줄바꿈도 분할 신호로 본다.
// 또한 종결부호가 한동안 없으면(긴 한 문장) 쉼표·공백 경계에서 조기 방출(soft-flush)해
// TTS '말하기 시작' 지연을 줄인다.
const ENDERS = /[.!?。！？\n]/;
const SOFT_AT = 40;                 // 이 길이 초과 시 경계에서 조기 방출 시도
const SOFT_BOUNDARY = /[,，、\s]/;   // soft-flush 경계 후보(쉼표·공백)

export function createSentenceBuffer() {
  let buf = "";

  function drainEnders(out: string[]) {
    let m: RegExpExecArray | null;
    // 종결부호(또는 줄바꿈) 위치까지 잘라 방출 (부호 포함)
    while ((m = ENDERS.exec(buf)) !== null) {
      const end = m.index + 1;
      const sentence = buf.slice(0, end).replace(/\n/g, " ").trim();
      if (sentence) out.push(sentence);
      buf = buf.slice(end);
    }
  }

  return {
    feed(delta: string): string[] {
      buf += delta;
      const out: string[] = [];
      drainEnders(out);
      // soft-flush: 종결부호 없이 길어지면 마지막 경계(쉼표/공백)에서 끊어 조기 방출
      while (buf.length > SOFT_AT) {
        let cut = -1;
        for (let i = Math.min(buf.length - 1, SOFT_AT + 20); i >= 12; i--) {
          if (SOFT_BOUNDARY.test(buf[i])) { cut = i + 1; break; }
        }
        if (cut <= 0) break;
        const piece = buf.slice(0, cut).trim();
        if (piece) out.push(piece);
        buf = buf.slice(cut);
      }
      return out;
    },
    flush(): string {
      const rest = buf.replace(/\n/g, " ").trim();
      buf = "";
      return rest;
    },
  };
}
