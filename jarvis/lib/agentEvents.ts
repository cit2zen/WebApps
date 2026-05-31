// lib/agentEvents.ts
import type { AgentEvent } from "./events";

// SDKMessage는 큰 union이므로 필요한 필드만 느슨히 받는다.
type LooseMsg = any;

export function createEventMapper() {
  let started = false;
  let speaking = false;

  return function map(msg: LooseMsg): AgentEvent[] {
    const out: AgentEvent[] = [];
    if (!started) {
      started = true;
      out.push({ type: "state", state: "thinking" });
    }

    if (
      msg?.type === "stream_event" &&
      msg.event?.type === "content_block_delta" &&
      msg.event.delta?.type === "text_delta"
    ) {
      if (!speaking) {
        speaking = true;
        out.push({ type: "state", state: "speaking" });
      }
      out.push({ type: "text", delta: msg.event.delta.text ?? "" });
    } else if (msg?.type === "assistant") {
      for (const block of msg.message?.content ?? []) {
        if (block?.type === "tool_use") {
          if (block.name === "Agent" || block.name === "Task") {
            out.push({ type: "subagent", name: block.input?.subagent_type ?? "researcher" });
          } else {
            out.push({ type: "tool", name: block.name });
          }
        }
      }
    } else if (msg?.type === "result") {
      if (msg.subtype === "success") {
        out.push({ type: "done", sessionId: msg.session_id });
      } else {
        out.push({ type: "error", message: (msg.errors ?? []).join("; ") || "실행 오류" });
      }
    }
    return out;
  };
}
