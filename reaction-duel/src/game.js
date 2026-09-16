const PLAYERS = new Set(["p1", "p2"]);

function opponentOf(player) {
  return player === "p1" ? "p2" : "p1";
}

export class RoundController {
  constructor({
    now = () => performance.now(),
    random = Math.random,
    schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = (timer) => clearTimeout(timer),
  } = {}) {
    this.now = now;
    this.random = random;
    this.schedule = schedule;
    this.cancel = cancel;
    this.listeners = new Set();
    this.timer = null;
    this.state = "ready";
    this.round = 0;
    this.delayMs = null;
    this.signalAt = null;
    this.result = null;
  }

  onChange(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return {
      state: this.state,
      round: this.round,
      delayMs: this.delayMs,
      signalAt: this.signalAt,
      result: this.result ? { ...this.result } : null,
    };
  }

  start() {
    if (this.state === "waiting" || this.state === "signal") return;
    this.clearTimer();
    this.round += 1;
    this.delayMs = 1500 + Math.floor(this.random() * 2501);
    this.signalAt = null;
    this.result = null;
    this.state = "waiting";
    this.timer = this.schedule(() => {
      if (this.state !== "waiting") return;
      this.timer = null;
      this.state = "signal";
      this.signalAt = this.now();
      this.emit();
    }, this.delayMs);
    this.emit();
  }

  press(player) {
    if (!PLAYERS.has(player) || this.state === "ready" || this.state === "result") return;
    if (this.state === "waiting") {
      this.resolve({
        winner: opponentOf(player),
        loser: player,
        reason: "false-start",
        reactionMs: null,
      });
      return;
    }
    this.resolve({
      winner: player,
      loser: opponentOf(player),
      reason: "reaction",
      reactionMs: Math.max(0, Math.round(this.now() - this.signalAt)),
    });
  }

  reset() {
    this.clearTimer();
    this.state = "ready";
    this.delayMs = null;
    this.signalAt = null;
    this.result = null;
    this.emit();
  }

  resolve(result) {
    if (this.state === "result") return;
    this.clearTimer();
    this.state = "result";
    this.result = result;
    this.emit();
  }

  clearTimer() {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
  }

  emit() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
