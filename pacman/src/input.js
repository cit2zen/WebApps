// 키보드(방향키 + WASD) + 터치 스와이프 입력.
// 마지막으로 요청된 방향을 보관한다(이동 측에서 버퍼링).
export const DIR = {
  NONE: { x: 0, y: 0 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
};

export class Input {
  constructor(onStart, onPause) {
    this.requested = DIR.NONE;
    this.onStart = onStart;
    this.onPause = onPause;
    this._bindKeys();
    this._bindTouch();
  }

  _set(dir) {
    this.requested = dir;
    if (this.onStart) this.onStart();
  }

  _bindKeys() {
    window.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowLeft": case "a": case "A": this._set(DIR.LEFT); break;
        case "ArrowRight": case "d": case "D": this._set(DIR.RIGHT); break;
        case "ArrowUp": case "w": case "W": this._set(DIR.UP); break;
        case "ArrowDown": case "s": case "S": this._set(DIR.DOWN); break;
        case "Enter": case " ": if (this.onStart) this.onStart(); break;
        case "p": case "P": if (this.onPause) this.onPause(); break;
        default: return;
      }
      e.preventDefault();
    }, { passive: false });
  }

  _bindTouch() {
    let sx = 0, sy = 0, active = false;
    const target = document.getElementById("stage") || window;
    target.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; active = true;
      if (this.onStart) this.onStart();
    }, { passive: true });
    target.addEventListener("touchend", (e) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // 탭은 시작용
      if (Math.abs(dx) > Math.abs(dy)) {
        this.requested = dx > 0 ? DIR.RIGHT : DIR.LEFT;
      } else {
        this.requested = dy > 0 ? DIR.DOWN : DIR.UP;
      }
    }, { passive: true });
  }
}
