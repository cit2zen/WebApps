// 민감도 설정(0~100) 저장/로드. 음량 임계값으로 변환.
const KEY = "yaong-jump-sensitivity";

export class Settings {
  constructor() {
    const saved = parseInt(localStorage.getItem(KEY), 10);
    this.sensitivity = Number.isFinite(saved) ? saved : 50; // 0~100
  }

  set(value) {
    this.sensitivity = Math.max(0, Math.min(100, value));
    localStorage.setItem(KEY, String(this.sensitivity));
  }

  // 점프 발사 임계값(0~1). 민감도 높을수록 임계값 낮음(작은 소리에 반응).
  // 민감도 0 → 0.55, 100 → 0.05
  get threshold() {
    return 0.55 - (this.sensitivity / 100) * 0.5;
  }
}
