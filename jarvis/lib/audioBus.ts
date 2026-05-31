// lib/audioBus.ts
// 고빈도 값은 React state가 아니라 mutable 싱글톤으로 흘려 60fps 유지.
export type Mode = "idle" | "listening" | "thinking" | "speaking";
export const MODE_NUM: Record<Mode, number> = { idle: 0, listening: 1, thinking: 2, speaking: 3 };

// 셰이더가 useFrame에서 직접 읽는 값들
export const audio = {
  amplitude: 0,         // 0..1, 시각화에 쓰는 최종 진폭
  bands: [0, 0, 0, 0, 0] as number[],
  speakingEnv: 0,       // 말하기 중 단어 경계로 튀고 RAF에서 감쇠하는 엔벌로프
};
export const STATE = { current: 0 }; // Mode 숫자 미러 (useFrame 저비용 읽기용)
