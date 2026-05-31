// tests/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useJarvisStore } from "@/lib/store";
import { STATE } from "@/lib/audioBus";

describe("useJarvisStore", () => {
  beforeEach(() => useJarvisStore.getState().reset());

  it("기본 모드는 idle", () => {
    expect(useJarvisStore.getState().mode).toBe("idle");
    expect(STATE.current).toBe(0);
  });

  it("setMode는 STATE.current 숫자 미러를 동기화한다", () => {
    useJarvisStore.getState().setMode("thinking");
    expect(useJarvisStore.getState().mode).toBe("thinking");
    expect(STATE.current).toBe(2);
  });

  it("자막/도구 알림을 저장한다", () => {
    useJarvisStore.getState().setTranscript("안녕");
    useJarvisStore.getState().setNotice("웹검색");
    expect(useJarvisStore.getState().transcript).toBe("안녕");
    expect(useJarvisStore.getState().notice).toBe("웹검색");
  });
});
