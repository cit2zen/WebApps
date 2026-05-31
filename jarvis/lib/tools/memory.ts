// lib/tools/memory.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readMemory, appendMemory } from "@/lib/memory";
import { MEMORY_PATH } from "@/lib/persona";

export const memoryTool = tool(
  "memory",
  "사용자에 대한 장기 기억을 읽거나(action=read) 새 사실을 추가한다(action=append)",
  {
    action: z.enum(["read", "append"]).describe("수행할 작업"),
    text: z.string().optional().describe("append할 때 저장할 사실"),
  },
  async (args) => {
    try {
      if (args.action === "append") {
        await appendMemory(MEMORY_PATH, args.text ?? "");
        return { content: [{ type: "text", text: "기억했습니다." }] };
      }
      const items = await readMemory(MEMORY_PATH);
      return { content: [{ type: "text", text: items.length ? items.join("\n") : "(저장된 기억 없음)" }] };
    } catch (e) {
      // throw하면 query 전체가 죽으므로 isError로 루프 유지
      return { content: [{ type: "text", text: `메모리 오류: ${String(e)}` }], isError: true };
    }
  }
);
