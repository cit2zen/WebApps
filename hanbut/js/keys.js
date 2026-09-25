// keys.js — 키보드 → {type:'key', action, repeat} (§2 조작 표 · §6 키보드 매핑)
// dispatch·board·sheetOpen은 main.js가 init()에 주입 — game·lobby import 없음.

const DELEGATE_SCOPE = '#lobby,#help,#settings,#overlay-pause,#result';
const FOCUSABLE = 'button,[role=button],a[href],[tabindex]';

export function init({ dispatch, board, sheetOpen }) {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;                 // 브라우저 단축키(새로고침 등) 보존
    const a = document.activeElement;
    if ((e.key === 'Enter' || e.key === ' ') && a && a !== board
        && a.closest && a.closest(DELEGATE_SCOPE)
        && a.matches(FOCUSABLE)) return;                             // 로비·시트·일시정지·결과 안 포커스 요소 → 네이티브 click 위임
    if (sheetOpen && sheetOpen()) return;                            // 시트 열림 중 전부 무시(Escape는 lobby.js 캡처가 처리)
    const action = keyToAction(e);
    if (!action) return;
    e.preventDefault();                                              // Space·방향키 스크롤 차단
    dispatch({ type: 'key', action, repeat: e.repeat === true });
  });
}

export function keyToAction(e) {
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'z': case 'Z': case 'Backspace': return 'pop';      // 연타 = 1묶음(§3)
    case 'r': case 'R': return 'reset';                     // 즉시, u += 2
    case 'h': case 'H': return 'hint';                      // hintReady일 때만 허용(표)
    case 'Enter': case ' ': return 'confirm';               // paused→resume · result→skip(정지 카드=next) · idle→이어하기
    case 'n': case 'N': return 'next';
    case 'p': case 'P': return 'prev';
    case 'Escape': return 'esc';                            // playing→pause · paused→resume
    case 'l': case 'L': return 'lobby';
    default: return null;
  }
}
