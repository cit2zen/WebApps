"""e2e_result — §8 16~21a단계: S8 관측·완주·S10·공유 텍스트·저장·성능·짧은 화면·S10a·재도전·S9a 나가기·console error 0."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8808                                               # interfaces §A: e2e_result 전용 포트
SHOTS = os.environ.get('DOLTAP_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))  # 기본 tools/tests/out(gitignore)
os.makedirs(SHOTS, exist_ok=True)
HOLD = """() => { const { state, aim, drop, step, dispatch } = window.__doltap;
  for (let i = 0; i < 60000; i++) {
    if (state() === 'aim') { aim(195, 0); drop(); }
    const s = step(1);
    if (s === 'hold') { const c = document.querySelector('#count').textContent; dispatch({ t: 'drop' }); return { c, st: state() }; }
    if (s === 'result') return { err: 'hold 미관측' };
  }
  return { err: 'timeout' }; }"""
SHOWN = """() => { const r = document.getElementById('result'), i = r && r.querySelector('img');
  return !!(r && !r.hidden && i && i.src.startsWith('data:image/png;base64,')); }"""
BOTTOMS = """() => ['#result .share-btn', '#result .retry-row button']
  .flatMap(s => [...document.querySelectorAll(s)]).map(e => e.getBoundingClientRect().bottom)"""
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def hook(page, expr):
    return page.evaluate(f'async () => window.__doltap.{expr}')


def text(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); return e ? e.textContent : null; }', sel)


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    hook(page, 'wipe()')
    page.reload()
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=10000)
    hook(page, "setToday('20261001')")
    hook(page, 'tut(true)')
    page.wait_for_timeout(1000)
    page.click('#card-today')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    # 16 — speed(1) + 동기 step(1) 루프로 S8 진입 관측
    hook(page, 'speed(1)')
    r = page.evaluate(HOLD)
    check(r == {'c': '3', 'st': 'hold'}, f'16 {r}')
    # 17 — result + S10
    u = hook(page, "until('result')")
    check(u['ok'] and u['state'] == 'result', f'17 until {u}')
    page.wait_for_function(SHOWN, timeout=5000)
    v = hook(page, 'view()')
    check(text(page, '#score .h') == f"{v['H']:.1f}cm", '17 점수 블록')
    check(page.evaluate("() => document.querySelector('#grid').textContent.split('\\n').map(r => [...r].length)") == [6, 6, 6, 6], '17 그리드')
    check(text(page, '#result .retry-label') == '공식 2회 남음', '17 보조 라벨')
    check(page.evaluate("() => getComputedStyle(document.querySelector('#result .share-note')).visibility") == 'hidden', '17 공유 안내 숨김')
    check(page.evaluate("() => document.querySelector('#result img').alt") == '완성한 돌탑', '17 스냅샷 alt')
    sh = page.evaluate('() => [document.scrollingElement.scrollHeight, innerHeight]')
    check(sh[0] <= sh[1], f'17 결과 390×844 스크롤 없음 {sh}')   # Task 6 리뷰 이월
    page.screenshot(path=os.path.join(SHOTS, 'doltap_s10_390x844.png'))
    # 18 — 공유 텍스트 7행·저장·성능
    t, st, stats = hook(page, 'shareText()').split('\n'), hook(page, 'store()'), hook(page, 'stats()')
    m = re.fullmatch(r'돌탑 #1 🪨 \d+\.\dcm \((\d+)/24\)', t[0]) if len(t) == 7 else None
    check(m is not None and int(m[1]) == v['left'], f'18 1행 {t[:1]}')
    cells = ''.join(t[1:5])
    check(all(len(row) == 6 for row in t[1:5]) and cells.count('🟨') + cells.count('🟫') == v['left'], '18 그리드 left')
    check(cells.count('💥') == v['fell'], '18 그리드 fell')
    check(len(t) == 7 and t[5] == '🔥연속 1일 · 도전 1/3', f'18 6행 {t[5:6]}')
    check(len(t) == 7 and re.fullmatch(r'https://games\.cityzen\.kr/doltap/\?d=20261001&c=\d{1,5}', t[6]) is not None, '18 7행')
    day = st['days']['20261001']
    check(day['tries'] == 1 and day['best']['H'] == v['H'] and st['streak'] == 1 and st['lastDay'] == '20261001', f'18 store {day}')
    check(stats['stepMs'] <= 2.0 and stats['drawMs'] <= 6 and stats['particles'] <= 60, f'18 성능 {stats}')
    check(stats['caches'] <= 24 and stats['reHulled'] == 0, f'18 캐시·reHulled {stats}')
    best_h = day['best']['H']
    # 19 — 360×640 짧은 화면: 스크롤 없음, 버튼 3개 화면 안
    page.set_viewport_size({'width': 360, 'height': 640})
    page.wait_for_timeout(300)
    check(page.evaluate('() => document.scrollingElement.scrollHeight') <= 640, '19 scrollHeight ≤ 640')
    check(all(b <= 640 for b in page.evaluate(BOTTOMS)), '19 공유·다시 쌓기·로비 보임')
    page.screenshot(path=os.path.join(SHOTS, 'doltap_s10_360x640.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    # 20 — S10a: forceShare('fallback') + S 키
    hook(page, "forceShare('fallback')")
    page.keyboard.press('s')
    page.wait_for_selector('#dlg-share textarea')
    check(page.evaluate("() => document.querySelector('#dlg-share textarea').value") == hook(page, 'shareText()'), '20 textarea')
    check(text(page, '#dlg-share .copy-hint') == '길게 눌러 복사하세요', '20 안내 문구')
    page.click('#dlg-share button:has-text("닫기")')
    check(page.locator('#dlg-share').count() == 0 and hook(page, 'state()') == 'result', '20 닫기 → S10')
    # 21 — R 재도전(공식) → 첫 낙하 tries 2 → Esc → 로비로 → S9a(기본 포커스 취소) → 나가기
    page.keyboard.press('r')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    check(hook(page, 'view().mode') == 'official', '21 R → 공식')
    page.wait_for_timeout(150)
    hook(page, 'aim(195, 0)')
    hook(page, 'drop()')
    check(hook(page, "store().days['20261001'].tries") == 2, '21 첫 낙하 tries 2')
    page.keyboard.press('Escape')
    page.wait_for_selector('#dlg-pause')
    page.click('#dlg-pause button:has-text("로비로")')
    page.wait_for_selector('#dlg-leave')
    check(text(page, '#dlg-leave .danger') == '공식 도전 1회가 사라져요', '21 S9a 문구')
    check(page.evaluate('() => document.activeElement.textContent') == '취소', '21 기본 포커스 취소')
    page.click('#dlg-leave button:has-text("나가기")')
    page.wait_for_function("() => window.__doltap.state() === 'lobby'")
    check(page.is_visible('#lobby') and page.locator('#dialogs .pol-overlay').count() == 0, '21 S2 복귀·대화상자 0')
    d2 = hook(page, "store().days['20261001']")
    check(d2['tries'] == 2 and d2['best']['H'] == best_h, f'21 tries 2·best 유지 {d2}')
    # 21a — 1판 완주 플로우 console error 0
    check(errors == [], f'21a console error {errors}')

if fails:
    print('FAIL e2e_result')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_result')
