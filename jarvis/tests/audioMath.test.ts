// tests/audioMath.test.ts
import { describe, it, expect } from "vitest";
import { rmsFromTimeData, bandsFromFreqData } from "@/lib/audioMath";

describe("audioMath", () => {
  it("무음(128 중심)의 RMS는 0", () => {
    const silent = new Uint8Array(64).fill(128);
    expect(rmsFromTimeData(silent)).toBeCloseTo(0, 5);
  });

  it("최대 진폭(255/0 교차)의 RMS는 약 1", () => {
    const loud = new Uint8Array(64);
    for (let i = 0; i < loud.length; i++) loud[i] = i % 2 === 0 ? 255 : 0;
    expect(rmsFromTimeData(loud)).toBeGreaterThan(0.9);
  });

  it("빈 배열은 NaN이 아닌 0을 반환한다", () => {
    expect(rmsFromTimeData(new Uint8Array(0))).toBe(0);
  });

  it("주파수 밴드를 0..1로 정규화해 N개 반환", () => {
    const freq = new Uint8Array(100).fill(255);
    const bands = bandsFromFreqData(freq, 5);
    expect(bands.length).toBe(5);
    expect(bands.every((b) => b > 0.9 && b <= 1)).toBe(true);
  });
});
