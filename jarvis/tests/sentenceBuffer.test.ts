// tests/sentenceBuffer.test.ts
import { describe, it, expect } from "vitest";
import { createSentenceBuffer } from "@/lib/sentenceBuffer";

describe("createSentenceBuffer", () => {
  it("종결부호가 나오면 완성 문장을 방출한다", () => {
    const b = createSentenceBuffer();
    expect(b.feed("안녕하")).toEqual([]);
    expect(b.feed("세요. 반갑")).toEqual(["안녕하세요."]);
    expect(b.feed("습니다!")).toEqual(["반갑습니다!"]);
  });

  it("한 delta에 여러 종결부호가 있으면 모두 분리해 방출한다", () => {
    const b = createSentenceBuffer();
    expect(b.feed("가. 나! 다?")).toEqual(["가.", "나!", "다?"]);
  });

  it("flush는 남은 텍스트를 반환하고 비운다", () => {
    const b = createSentenceBuffer();
    b.feed("끝맺지 않은 말");
    expect(b.flush()).toBe("끝맺지 않은 말");
    expect(b.flush()).toBe("");
  });
});
