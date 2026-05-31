// tests/agentEvents.test.ts
import { describe, it, expect } from "vitest";
import { createEventMapper } from "@/lib/agentEvents";

describe("createEventMapper", () => {
  it("첫 메시지에서 thinking 상태를 1회 방출한다", () => {
    const map = createEventMapper();
    const out = map({ type: "system", subtype: "init", session_id: "s1" } as any);
    expect(out[0]).toEqual({ type: "state", state: "thinking" });
  });

  it("첫 text 델타 전에 speaking을 1회 방출하고 텍스트를 흘린다", () => {
    const map = createEventMapper();
    map({ type: "system", subtype: "init" } as any);
    const out = map({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "안녕" } },
    } as any);
    expect(out).toEqual([
      { type: "state", state: "speaking" },
      { type: "text", delta: "안녕" },
    ]);
    // 두 번째 델타엔 speaking 재방출 없음
    const out2 = map({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "하세요" } },
    } as any);
    expect(out2).toEqual([{ type: "text", delta: "하세요" }]);
  });

  it("tool_use는 tool 이벤트, Agent/Task는 subagent 이벤트", () => {
    const map = createEventMapper();
    map({ type: "system" } as any);
    const tool = map({ type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch" }] } } as any);
    expect(tool).toContainEqual({ type: "tool", name: "WebSearch" });
    const sub = map({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "researcher" } }] },
    } as any);
    expect(sub).toContainEqual({ type: "subagent", name: "researcher" });
  });

  it("result success는 done(sessionId), 에러는 error", () => {
    const ok = createEventMapper();
    ok({ type: "system" } as any);
    expect(ok({ type: "result", subtype: "success", session_id: "s9" } as any))
      .toContainEqual({ type: "done", sessionId: "s9" });

    const bad = createEventMapper();
    bad({ type: "system" } as any);
    expect(bad({ type: "result", subtype: "error_during_execution", errors: ["boom"] } as any))
      .toContainEqual({ type: "error", message: "boom" });
  });
});
