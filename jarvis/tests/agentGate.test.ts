// tests/agentGate.test.ts
import { describe, it, expect } from "vitest";
import { canUseTool } from "@/lib/agent";

describe("canUseTool permission gate", () => {
  it("WebSearch 허용: 원본 input을 그대로 echo한다 (updatedInput: {} 아님)", async () => {
    const input = { query: "삼성전자" };
    const result = await canUseTool("WebSearch", input, {} as any);
    expect(result.behavior).toBe("allow");
    expect((result as any).updatedInput).toEqual(input);
    // 회귀 보호: updatedInput이 {} 이면 안 된다
    expect((result as any).updatedInput).not.toEqual({});
  });

  it("mcp__app__memory 허용: 원본 input을 그대로 echo한다", async () => {
    const input = { action: "append", text: "x" };
    const result = await canUseTool("mcp__app__memory", input, {} as any);
    expect(result.behavior).toBe("allow");
    expect((result as any).updatedInput).toEqual({ action: "append", text: "x" });
  });

  it("Bash 거부: behavior=deny, message가 비어있지 않다", async () => {
    const result = await canUseTool("Bash", { command: "rm -rf /" }, {} as any);
    expect(result.behavior).toBe("deny");
    expect((result as { behavior: string; message?: string }).message).toBeTruthy();
  });
});
