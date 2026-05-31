// tests/sse.test.ts
import { describe, it, expect } from "vitest";
import { serializeEvent, createSseParser } from "@/lib/sse";
import type { AgentEvent } from "@/lib/events";

describe("sse", () => {
  it("이벤트를 data 라인으로 직렬화한다", () => {
    const e: AgentEvent = { type: "text", delta: "안녕" };
    expect(serializeEvent(e)).toBe(`data: ${JSON.stringify(e)}\n\n`);
  });

  it("완성된 이벤트만 파싱하고 부분 청크는 버퍼링한다", () => {
    const push = createSseParser();
    const a: AgentEvent = { type: "text", delta: "가" };
    const b: AgentEvent = { type: "done", sessionId: "s1" };
    const full = serializeEvent(a) + serializeEvent(b);
    const firstHalf = full.slice(0, 10);
    const rest = full.slice(10);
    expect(push(firstHalf)).toEqual([]);          // 아직 \n\n 없음
    expect(push(rest)).toEqual([a, b]);           // 합쳐지면 둘 다
  });

  it("깨진 JSON은 조용히 무시한다", () => {
    const push = createSseParser();
    expect(push("data: {oops\n\n")).toEqual([]);
  });
});
