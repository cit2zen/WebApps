// 격자 렌더링 + 드래그 사각 선택. 합이 10이면 game.harvest 호출.
import { COLS, ROWS } from "./game.js";
import { pop, unlock } from "./sfx.js";

const PAD = 3; // 히트박스 여유(작게). 선택 범위에 실제로 닿아야 선택됨.

export class Board {
  constructor(game, gridEl, selRectEl, onScore, onWin) {
    this.game = game;
    this.gridEl = gridEl;
    this.selRectEl = selRectEl;
    this.onScore = onScore;
    this.onWin = onWin;
    this.appleEls = [];
    this.enabled = true;
    this.drag = null; // { x0, y0 }
    this._bindEvents();
  }

  render() {
    this.gridEl.innerHTML = "";
    this.appleEls = this.game.cells.map((v, i) => {
      const el = document.createElement("div");
      el.className = "apple";
      el.textContent = v;
      el.dataset.i = i;
      this.gridEl.appendChild(el);
      return el;
    });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this._cancelDrag(); // 시간 종료 시 진행 중 드래그를 즉시 무효화
  }

  // 진행 중 드래그 상태 강제 해제: 선택 표시·선택 목록·사각형 정리.
  _cancelDrag() {
    this.drag = null;
    this.selRectEl.hidden = true;
    if (this.selected) {
      for (const i of this.selected) this.appleEls[i]?.classList.remove("sel");
    }
    this.selected = [];
  }

  _bindEvents() {
    const grid = this.gridEl;
    grid.addEventListener("pointerdown", (e) => this._onDown(e));
    window.addEventListener("pointermove", (e) => this._onMove(e));
    window.addEventListener("pointerup", () => this._onUp());
  }

  _localPoint(e) {
    const r = this.gridEl.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  }

  _onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    unlock();
    const p = this._localPoint(e);
    this.drag = { x0: p.x, y0: p.y };
    // 드래그 시작 시 사과 좌표를 캐시(레이아웃 1회 읽기). PAD만큼 넓혀 판정을 너그럽게.
    this.rects = this.appleEls.map((el) => ({
      el,
      left: el.offsetLeft - PAD,
      top: el.offsetTop - PAD,
      right: el.offsetLeft + el.offsetWidth + PAD,
      bottom: el.offsetTop + el.offsetHeight + PAD,
    }));
  }

  _onMove(e) {
    if (!this.enabled || !this.drag) return;
    const p = this._localPoint(e);
    const x = Math.min(this.drag.x0, p.x);
    const y = Math.min(this.drag.y0, p.y);
    const w = Math.abs(p.x - this.drag.x0);
    const h = Math.abs(p.y - this.drag.y0);

    const s = this.selRectEl;
    s.hidden = false;
    s.style.left = x + this.gridEl.offsetLeft + "px";
    s.style.top = y + this.gridEl.offsetTop + "px";
    s.style.width = w + "px";
    s.style.height = h + "px";

    const rect = { left: x, top: y, right: x + w, bottom: y + h };
    this.selected = [];
    for (const r of this.rects) {
      const hit =
        r.left < rect.right && r.right > rect.left &&
        r.top < rect.bottom && r.bottom > rect.top;
      const alive = this.game.valueAt(+r.el.dataset.i) > 0;
      r.el.classList.toggle("sel", hit && alive);
      if (hit && alive) this.selected.push(+r.el.dataset.i);
    }
  }

  _onUp() {
    if (!this.enabled || !this.drag) return; // 비활성 상태의 release로 점수 획득 방지
    this.drag = null;
    this.selRectEl.hidden = true;

    const picked = this.selected || [];
    const gained = this.game.harvest(picked);
    for (const i of picked) {
      const el = this.appleEls[i];
      el.classList.remove("sel");
      if (gained > 0) {
        // 약간씩 다른 회전을 줘 자연스럽게 떨어지도록.
        el.style.setProperty("--r", (Math.random() * 50 - 25).toFixed(0) + "deg");
        el.classList.add("cleared");
      }
    }
    if (gained > 0) {
      pop(gained);
      this.onScore(this.game.score);
      if (this.game.remaining() === 0 && this.onWin) this.onWin();
    }
    this.selected = [];
  }
}
