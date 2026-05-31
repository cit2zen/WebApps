// lib/sse.ts
import type { AgentEvent } from "./events";

export function serializeEvent(e: AgentEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

// 청크가 쪼개져 들어와도 \n\n 경계로 안전하게 이벤트를 복원한다.
// NOTE: 이 파서는 이 앱 전용 미니멀 구현이다. \n\n 로 프레임을 구분하고
// 프레임당 첫 번째 "data:" 줄 하나만 읽는다 — 범용 SSE 파서가 아니다.
export function createSseParser() {
  let buffer = "";
  return function push(chunk: string): AgentEvent[] {
    buffer += chunk;
    const events: AgentEvent[] = [];
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        events.push(JSON.parse(json) as AgentEvent);
      } catch {
        /* 깨진 조각 무시 */
      }
    }
    return events;
  };
}
