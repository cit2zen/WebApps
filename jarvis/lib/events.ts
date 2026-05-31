// 서버 → 클라이언트로 흐르는 표준 이벤트 (SSE payload)
export type AgentEvent =
  | { type: "state"; state: "thinking" | "speaking" }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "subagent"; name: string }
  | { type: "done"; sessionId?: string }
  | { type: "error"; message: string };
