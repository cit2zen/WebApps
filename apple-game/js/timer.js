// requestAnimationFrame 기반 카운트다운. setInterval 금지 규칙 준수.
export class Timer {
  constructor(durationMs, onTick, onEnd) {
    this.duration = durationMs;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.startTs = null;
    this.rafId = null;
    this._loop = this._loop.bind(this);
  }

  start() {
    this.stop();
    this.startTs = null;
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  _loop(ts) {
    if (this.startTs === null) this.startTs = ts;
    const remaining = Math.max(0, this.duration - (ts - this.startTs));
    this.onTick(remaining, remaining / this.duration);
    if (remaining <= 0) {
      this.stop();
      this.onEnd();
      return;
    }
    this.rafId = requestAnimationFrame(this._loop);
  }
}

export function formatMMSS(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
