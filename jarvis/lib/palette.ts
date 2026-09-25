// lib/palette.ts
// Polaroid Editorial v2 팔레트 — CSS 변수를 읽을 수 없는 곳(WebGL 셰이더 uniform · 2D 캔버스 · 메타데이터 themeColor) 전용.
// 값은 develop_web/design-system/design-tokens.css (앱 사본: app/design-tokens.css)의 토큰을 그대로 미러링한다.
// 이 앱에서 hex 리터럴은 이 파일에만 둔다 — 토큰이 바뀌면 여기도 함께 갱신할 것.
// DOM 스타일은 여기 hex를 쓰지 말고 CSS var(--token)을 쓴다(아래 *_TOKEN 참고).
import type { Mode } from "./audioBus";

export const PALETTE = {
  bgBase: "#ece7dc", // --bg-base (인화지 크림)
  paper: "#fdf9f0", // --paper
  goldGlow: "#e8c878", // --gold-glow
  goldLight: "#d4b87a", // --gold-light
  goldMid: "#c0a060", // --gold-mid
  goldDark: "#9a7840", // --gold-dark
  goldText: "#7d5f28", // --gold-text
  inkLight: "#a09060", // --ink-light
  inkMuted: "#6e5a38", // --ink-muted
  inkMid: "#4a3820", // --ink-mid
  inkBrown: "#3a2a1a", // --ink-brown
} as const;

export type Tone = { base: string; ink: string; hi: string; ring: string; energy: number; halo: number; flow: number };

// 오브 톤 — STATE.current 인덱스 순서(idle 0 / listening 1 / thinking 2 / speaking 3).
// base=금박 바탕, ink=판화 등고선·윤곽, hi=하이라이트, ring=공전 헤어라인,
// energy=잉크 대비, halo=금빛 번짐 세기, flow=등고선 흐름 속도(상태 구분용 모션).
export const ORB_TONES: Tone[] = [
  { base: PALETTE.goldLight, ink: PALETTE.inkLight, hi: PALETTE.paper, ring: PALETTE.goldLight, energy: 0.45, halo: 0.55, flow: 0.45 }, // idle — 옅은 금, 느린 호흡
  { base: PALETTE.goldGlow, ink: PALETTE.goldText, hi: PALETTE.paper, ring: PALETTE.goldMid, energy: 0.7, halo: 1.0, flow: 1.0 }, // listening — 가장 밝은 금, 먼지 응축
  { base: PALETTE.goldDark, ink: PALETTE.inkBrown, hi: PALETTE.goldLight, ring: PALETTE.inkMuted, energy: 0.95, halo: 0.7, flow: 2.4 }, // thinking — 짙은 금·잉크, 빠른 소용돌이
  { base: PALETTE.goldMid, ink: PALETTE.inkMid, hi: PALETTE.paper, ring: PALETTE.goldDark, energy: 0.8, halo: 0.9, flow: 1.3 }, // speaking — 따뜻한 금, 진폭 펄스
];

// 네뷸라(금가루 + 잉크 점) — 상태별 금가루 톤. 잉크 점은 공통.
export const DUST_TONES = [PALETTE.goldLight, PALETTE.goldMid, PALETTE.goldDark, PALETTE.goldMid];
export const SPECK_INK = PALETTE.inkMid;

// HUD(레티클·파형) 강조색 — DOM은 token(var), 2D 캔버스는 hex.
export const MODE_ACCENT: Record<Mode, { token: string; hex: string }> = {
  idle: { token: "var(--gold-light)", hex: PALETTE.goldLight },
  listening: { token: "var(--gold-mid)", hex: PALETTE.goldMid },
  thinking: { token: "var(--gold-dark)", hex: PALETTE.goldDark },
  speaking: { token: "var(--gold-mid)", hex: PALETTE.goldMid },
};
