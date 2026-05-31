/** 한 줄을 안전하게 파싱: 손상/부분 JSON이면 건너뛰고 콜백을 호출하지 않는다 */
function safeParseLine(line: string, onMessage: (msg: any) => void): void {
  try {
    onMessage(JSON.parse(line));
  } catch {
    // 손상된 줄 하나가 전체 스트림 소비를 죽이지 않도록 건너뛴다
    console.warn('[readNdjson] 손상된 줄을 건너뜀:', line);
  }
}

/** Response 바디(NDJSON 스트림)를 한 줄씩 파싱해 콜백 호출 */
export async function readNdjson(
  res: Response,
  onMessage: (msg: any) => void,
): Promise<void> {
  if (!res.body) {
    // 스트림 미지원 환경: 전체 텍스트를 줄 단위 파싱
    const text = await res.text();
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (t) safeParseLine(t, onMessage);
    }
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) safeParseLine(line, onMessage);
    }
  }
  const tail = buf.trim();
  if (tail) safeParseLine(tail, onMessage);
}
