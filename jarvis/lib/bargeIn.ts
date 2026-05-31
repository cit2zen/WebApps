// lib/bargeIn.ts
export interface BargeInOptions {
  speakingThreshold?: number;   // TTS 중 마이크 RMS 임계치 (에코 때문에 높게)
  sustainMs?: number;           // 이만큼 지속돼야 끼어들기로 판정
  graceMsAfterTtsStart?: number;// TTS 시작 직후 무시 구간 (레벨 안정화)
  onBargeIn?: () => void;
}

// 매 프레임 tick(rms, isSpeaking, now) 호출.
export function makeBargeInDetector(opts: BargeInOptions = {}) {
  const speakingThreshold = opts.speakingThreshold ?? 0.12;
  const sustainMs = opts.sustainMs ?? 150;
  const graceMsAfterTtsStart = opts.graceMsAfterTtsStart ?? 250;
  const onBargeIn = opts.onBargeIn;

  let aboveSince = -1;
  let ttsStartedAt = 0;
  let lastSpeaking = false;

  return function tick(rms: number, isSpeaking: boolean, now: number): void {
    if (isSpeaking && !lastSpeaking) ttsStartedAt = now;
    lastSpeaking = isSpeaking;

    if (!isSpeaking) { aboveSince = -1; return; }
    if (now - ttsStartedAt < graceMsAfterTtsStart) { aboveSince = -1; return; }

    if (rms >= speakingThreshold) {
      if (aboveSince < 0) aboveSince = now;
      if (now - aboveSince >= sustainMs) {
        aboveSince = -1;
        onBargeIn?.();
      }
    } else {
      aboveSince = -1;
    }
  };
}
