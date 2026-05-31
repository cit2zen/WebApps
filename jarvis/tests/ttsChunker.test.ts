// tests/ttsChunker.test.ts
import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/ttsChunker";

describe("chunkText", () => {
  it("짧은 텍스트는 그대로 한 덩어리", () => {
    expect(chunkText("안녕하세요.")).toEqual(["안녕하세요."]);
  });

  it("문장 종결부호로 나눈다", () => {
    const out = chunkText("안녕하세요. 무엇을 도와드릴까요?", 50);
    expect(out.length).toBe(2);
    expect(out[0]).toContain("안녕하세요");
  });

  it("maxLen보다 긴 한 문장은 하드 분할한다", () => {
    const long = "가".repeat(500);
    const out = chunkText(long, 180);
    expect(out.every((c) => c.length <= 180)).toBe(true);
    expect(out.join("")).toBe(long);
  });

  it("빈 문자열은 빈 배열", () => {
    expect(chunkText("")).toEqual([]);
  });
});
