// DOM 입력 패널. 브라우저 IME가 조합을 처리하고, 매 input 이벤트를 Unity로 보낸다.
window.SubwayInput = (function () {
  var target = null, panel, input, chips;

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
  function clear() { input.value = ''; chips.textContent = ''; }
  // hidden 패널도 CSS상 display:block(출처 줄만 표시) — 표시 여부 판정은 panel.hidden / #answer 가시성으로
  function setVisible(v) { panel.hidden = !v; if (v) input.focus(); }
  function bind(name) { target = name; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { bind: bind, setSuggestions: setSuggestions, clear: clear, setVisible: setVisible };
})();
