// tests/bargeIn.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeBargeInDetector } from "@/lib/bargeIn";

describe("makeBargeInDetector", () => {
  it("TTS 재생 중 + 임계치 지속 시 콜백 1회", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({
      speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn,
    });
    let now = 1000;
    tick(0.5, true, now);            // 시작
    tick(0.5, true, (now += 100));   // 100ms 지속
    expect(onBargeIn).not.toHaveBeenCalled();
    tick(0.5, true, (now += 100));   // 200ms 지속 → 발화
    expect(onBargeIn).toHaveBeenCalledTimes(1);
  });

  it("TTS 미재생 시엔 트리거하지 않는다", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({ speakingThreshold: 0.1, sustainMs: 50, graceMsAfterTtsStart: 0, onBargeIn });
    let now = 0;
    tick(0.9, false, (now += 100));
    tick(0.9, false, (now += 100));
    expect(onBargeIn).not.toHaveBeenCalled();
  });

  it("now=0 에서 시작해도 센티넬 버그 없이 정상 발화한다", () => {
    // 구 sentinel(0)이면 aboveSince=0을 '미시작'으로 오해해 발화가 지연됐다.
    // 수정 후: aboveSince=-1 이므로 clock이 0에서 시작해도 올바르게 동작한다.
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({
      speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn,
    });
    tick(0.5, true, 0);    // aboveSince 를 0으로 고정 (clock 기준점)
    expect(onBargeIn).not.toHaveBeenCalled();
    tick(0.5, true, 150);  // now - aboveSince = 150 >= 150 → 발화
    expect(onBargeIn).toHaveBeenCalledTimes(1);
  });

  it("발화 후 재무장: 계속 큰 소리면 sustainMs 뒤 다시 발화한다", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({
      speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn,
    });
    tick(0.5, true, 0);
    tick(0.5, true, 150);  // 1차 발화
    expect(onBargeIn).toHaveBeenCalledTimes(1);
    // 발화 직후 aboveSince=-1 로 리셋됨 → 다음 틱에서 재무장
    tick(0.5, true, 151);  // aboveSince = 151
    tick(0.5, true, 301);  // 301 - 151 = 150 >= 150 → 2차 발화
    expect(onBargeIn).toHaveBeenCalledTimes(2);
  });

  it("임계치 아래로 떨어지면 지속 타이머 리셋", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({ speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn });
    let now = 0;
    tick(0.5, true, (now += 100));
    tick(0.0, true, (now += 100));   // 리셋
    tick(0.5, true, (now += 100));
    expect(onBargeIn).not.toHaveBeenCalled();
  });
});
