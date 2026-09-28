// DOM 입력 패널. 브라우저 IME가 조합을 처리하고, 매 input 이벤트를 Unity로 보낸다.
window.SubwayInput = (function () {
  var target = null, panel, input, chips, turn;
  var MODES = [['timed', '시간제한'], ['endless', '무제한'], ['duel', '2인 대결']];

  function send(method, payload) {
    if (window.unityInstance && target) window.unityInstance.SendMessage(target, method, payload);
  }
  function emitInput(composing) {
    send('OnInput', JSON.stringify({ value: input.value, composing: !!composing }));
  }
  function init() {
    panel = document.getElementById('input-panel');
    input = document.getElementById('answer');
    chips = document.getElementById('chips');
    turn = document.getElementById('turn');
    input.addEventListener('input', function (e) { emitInput(e.isComposing); });
    input.addEventListener('compositionend', function () { emitInput(false); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {   // 229 = IME 조합 중
        e.preventDefault();
        send('OnSubmit', input.value);
      }
    });
    if (window.visualViewport) {
      var vv = window.visualViewport;
      var reposition = function () {   // 소프트 키보드 위로 패널 올리기
        panel.style.bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px';
      };
      vv.addEventListener('resize', reposition);
      vv.addEventListener('scroll', reposition);
    }
  }
  function setSuggestions(list) {
    chips.textContent = '';                       // innerHTML 금지 — 역명은 textContent로만
    list.forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = name;
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();                       // 포커스가 input에서 떠나지 않게
        input.value = name; input.focus(); emitInput(false);
      });
      chips.appendChild(b);
    });
  }
  function chipButton(cls, onPick) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls;
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); onPick(); });
    b.addEventListener('click', function (e) { if (e.detail === 0) { e.preventDefault(); onPick(); } });   // 키보드(Tab → Space/Enter)
    return b;
  }
  // 홈: 모드 칩 3개(시간제한·무제한·2인 대결 — 누르면 모드만 바뀜) + 노선 칩(같은 #chips 줄, 누르면 그 노선으로 바로 시작).
  // 색 견본만 데이터 색(#rrggbb 검증) 인라인.
  function setLines(list, mode) {
    chips.textContent = '';
    if (mode) {
      MODES.forEach(function (m) {
        var b = chipButton('chip chip-mode', function () { send('OnSelectMode', m[0]); });
        b.dataset.mode = m[0];
        b.setAttribute('aria-pressed', m[0] === mode ? 'true' : 'false');
        b.textContent = m[1];
        chips.appendChild(b);
      });
      var sep = document.createElement('span');
      sep.className = 'chip-sep'; sep.setAttribute('aria-hidden', 'true');
      chips.appendChild(sep);
    }
    list.forEach(function (ln) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip chip-line';
      b.setAttribute('aria-pressed', ln.selected ? 'true' : 'false');
      b.dataset.line = ln.id;
      var sw = document.createElement('span');
      sw.className = 'chip-swatch';
      if (/^#[0-9a-fA-F]{6}$/.test(ln.color || '')) sw.style.background = ln.color;
      b.appendChild(sw);
      b.appendChild(document.createTextNode(ln.name));   // textContent 계열만
      var pick = function (e) { e.preventDefault(); send('OnSelectLine', ln.id); };
      b.addEventListener('pointerdown', pick);
      b.addEventListener('click', function (e) { if (e.detail === 0) pick(e); });   // 키보드(Tab → Space/Enter)
      chips.appendChild(b);
    });
  }
  function clear() { input.value = ''; chips.textContent = ''; }
  // 2인 대결: 지금 차례(1P/2P)를 패널 위 띠와 색(1P 청색 · 2P 녹색 토큰)으로 구분. 대결이 아니면 숨김.
  function onState(s) {
    if (!turn) return;
    var p = s && s.mode === 'duel' ? (s.player | 0) : 0;
    var key = p ? String(p) : '';
    if (panel.dataset.player === key) return;
    panel.dataset.player = key;
    turn.hidden = !p;
    turn.textContent = p ? p + 'P 차례' : '';
    input.placeholder = p ? p + 'P — 역 이름을 입력하세요' : '역 이름을 입력하세요';
  }
  // hidden 패널도 CSS상 display:block(출처 줄만 표시) — 표시 여부 판정은 panel.hidden / #answer 가시성으로
  function setVisible(v) { panel.hidden = !v; if (v) input.focus(); }
  function bind(name) { target = name; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { bind: bind, setSuggestions: setSuggestions, setLines: setLines, clear: clear, setVisible: setVisible, onState: onState };
})();
