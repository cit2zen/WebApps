// lib/tools/time.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";

export const timeTool = tool(
  "now",
  "현재 서버의 날짜와 시간을 한국 시간 기준 문자열로 반환한다",
  {},
  async () => {
    const now = new Date();
    const text = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    return { content: [{ type: "text", text }] };
  },
  { annotations: { readOnlyHint: true } }
);
