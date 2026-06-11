const POINTS = { imp: 100, caster: 150, charger: 200, boss: 1000 };
const COMBO_WINDOW = 2.5;

export class Score {
  constructor() {
    this._score = 0;
    this._combo = 1;
    this._timer = 0;
    this._kills = 0;
    this._injectDOM();
  }

  _injectDOM() {
    // #hud 안에 넣어 메뉴/일시정지/사망 화면에서 HUD와 함께 숨겨지게 한다
    const host = document.getElementById('hud') ?? document.body;
    if (!document.getElementById('score')) {
      const s = document.createElement('div');
      s.id = 'score';
      host.appendChild(s);
    }
    if (!document.getElementById('combo')) {
      const c = document.createElement('div');
      c.id = 'combo';
      host.appendChild(c);
    }
    this._scoreEl = document.getElementById('score');
    this._comboEl = document.getElementById('combo');
    this._render();
  }

  addKill(type) {
    const base = POINTS[type] ?? 100;
    this._score += base * this._combo;
    this._kills++;
    this._combo++;
    this._timer = COMBO_WINDOW;
    this._render();
  }

  reset() {
    this._score = 0;
    this._combo = 1;
    this._timer = 0;
    this._kills = 0;
    this._render();
  }

  getScore() { return this._score; }
  getCombo() { return this._combo; }
  getKills() { return this._kills; }

  update(dt) {
    if (this._combo <= 1) return;
    this._timer -= dt;
    if (this._timer <= 0) {
      this._combo = 1;
      this._timer = 0;
      this._render();
    }
  }

  _render() {
    if (this._scoreEl) {
      this._scoreEl.textContent = this._score.toLocaleString();
    }
    if (this._comboEl) {
      if (this._combo > 1) {
        this._comboEl.textContent = `x${this._combo}`;
        this._comboEl.classList.add('active');
      } else {
        this._comboEl.textContent = '';
        this._comboEl.classList.remove('active');
      }
    }
  }
}
