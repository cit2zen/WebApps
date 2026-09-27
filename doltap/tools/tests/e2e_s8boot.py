"""e2e_s8boot — §8 1·2·3·3a단계: S0 → S2 1500ms, 카드 3장·앱바 3개, 1280×800 Pyramid, 첫 로드 ≤ 360,000B, console error 0."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8806                                               # interfaces §A: e2e_s8boot 전용 포트
BASE = f'http://127.0.0.1:{PORT}/doltap/'
SHOTS = os.environ.get('DOLTAP_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))  # 기본 tools/tests/out(gitignore)
os.makedirs(SHOTS, exist_ok=True)
fails = []
POLL = "() => [window.__doltap ? window.__doltap.state() : null, performance.now()]"
INSIDE = """() => { const g = document.querySelector('#lobby .pol-group').getBoundingClientRect();
  return [...document.querySelectorAll('#lobby .pol-group .pol-card')].every(c => { const r = c.getBoundingClientRect();
    return r.top >= g.top - 1 && r.bottom <= g.bottom + 1 && r.left >= g.left - 1 && r.right <= g.right + 1; }); }"""
SIZE = """() => { const skip = u => /fonts\\.(googleapis|gstatic)\\.com/.test(u);
  const res = performance.getEntriesByType('resource').filter(e => !skip(e.name)).reduce((a, e) => a + (e.decodedBodySize || 0), 0);
  const nav = performance.getEntriesByType('navigation')[0];
  return { total: res + (nav ? nav.decodedBodySize : 0), matter: window.Matter ? window.Matter.version : null }; }"""


def check(cond, msg):
    if not cond:
        fails.append(msg)


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    # 1 — 새로 불러와 50ms 간격으로 state()를 읽는다(처음 'lobby'를 본 performance.now()가 상한)
    page.goto(BASE, wait_until='commit')
    t_lobby = None
    for _ in range(100):
        try:
            st, now = page.evaluate(POLL)
        except Exception:                                  # 문서 교체 중 실행 컨텍스트가 사라지면 다음 폴링에서 다시 읽는다
            st, now = None, None
        if st == 'lobby':
            t_lobby = now
            break
        page.wait_for_timeout(50)
    check(t_lobby is not None and t_lobby <= 1500, f'S2 표시 {t_lobby}ms (≤ 1500)')
    check('돌 고르는 중…' in (page.text_content('#boot') or ''), 'S0 로딩 문구 렌더')
    check(page.locator('#lobby .pol-card').count() == 3, '카드 3장')
    check(page.locator('#lobby .pol-appbar button').count() == 3, '앱바 🔊⚙? 3개')
    sh = page.evaluate('() => [document.scrollingElement.scrollHeight, innerHeight]')
    check(sh[0] <= sh[1], f'1 로비 390×844 스크롤 없음 {sh}')   # Task 6 리뷰 이월
    # 2 — 641px 이상: Cascade → Pyramid, 그룹 min-height 440 안에 카드 3장
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.wait_for_timeout(1200)
    check(page.evaluate("() => document.querySelector('#lobby .pol-group').classList.contains('open')"), '.open')
    check(page.evaluate("() => getComputedStyle(document.querySelector('#lobby .pol-group')).minHeight") == '440px', 'min-height 440px')
    check(page.evaluate(INSIDE), '카드 3장이 그룹 안')
    page.screenshot(path=os.path.join(SHOTS, 'doltap_s2_1280x800.png'))
    # 3 — 첫 로드 크기(구글 폰트 제외) + Matter 버전
    size = page.evaluate(SIZE)
    print(f"first-load decoded {size['total']}B, Matter {size['matter']}")
    check(size['total'] <= 360000, f"첫 로드 {size['total']}B > 360,000B")
    check(size['matter'] == '0.20.0', f"Matter.version {size['matter']}")
    # 3a — 4단계 재로드 전 console error 0
    check(errors == [], f'3a console error {errors}')

if fails:
    print('FAIL e2e_s8boot')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_s8boot')
