"""e2e_s10 — 구현 6단계 완료 기준: 공식 1판 완주 → S10, shareText() 7행, S10a 폴백, 등급 경계(B=200),
결과 화면 resize 뒤 스냅샷 유지 · R 재도전 → 공식 2번째 판 캔버스 재그리기."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8804                                               # interfaces §A: e2e_s10 전용 포트
fails = []
FINISH = """async () => { const d = window.__doltap;
  for (let i = 0; i < 3000; i++) {
    if (d.state() === 'aim') { d.aim(195, 0); d.drop(); }
    if (d.step(60) === 'hold') break;
  }
  return await d.until('result'); }"""
SHOWN = """() => { const r = document.getElementById('result'), i = r && r.querySelector('img');
  return !!(r && !r.hidden && i && i.src.startsWith('data:image/png;base64,')); }"""
GRADES = """async () => { const m = await import('./js/result.js');
  return [99.9, 100, 199.9, 200, 279.9, 280, 359.9, 360].map(h => m.grade(h, 200)); }"""


def check(cond, msg):
    if not cond:
        fails.append(msg)


def text(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); return e ? e.textContent : null; }', sel)


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    page.evaluate('() => window.__doltap.wipe()')
    page.reload()
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=10000)
    page.evaluate("() => { window.__doltap.setToday('20261001'); window.__doltap.tut(true); }")
    page.wait_for_timeout(1000)
    page.click('#card-today')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    r = page.evaluate(FINISH)
    check(r['ok'] and r['state'] == 'result', f'until(result) {r}')
    page.wait_for_function(SHOWN, timeout=5000)
    t = page.evaluate('() => window.__doltap.shareText()').split('\n')
    v = page.evaluate("() => window.__doltap.store().days['20261001'].best")   # 기록된 판 = R.result()(view().left 아님)
    check(len(t) == 7, f'shareText {len(t)}행')
    m = re.fullmatch(r'돌탑 #1 🪨 (\d+\.\d)cm \((\d+)/24\)', t[0])
    check(m is not None and float(m[1]) == v['H'] and int(m[2]) == v['left'], f'1행 {t[0]!r}')
    check(all(len(row) == 6 for row in t[1:5]), '2~5행 6칸')
    check(t[5] == '🔥연속 1일 · 도전 1/3', f'6행 {t[5]!r}')
    check(re.fullmatch(r'https://games\.cityzen\.kr/doltap/\?d=20261001&c=\d{1,5}', t[6]) is not None, f'7행 {t[6]!r}')
    check(text(page, '#score .h') == f"{v['H']:.1f}cm", '점수 블록 H')
    check(text(page, '#result .pol-appbar-title') == '돌탑 #1 결과', '헤더')
    check(text(page, '#result .retry-label') == '공식 2회 남음', '보조 라벨')
    check(page.evaluate("() => getComputedStyle(document.querySelector('#result .share-note')).visibility") == 'hidden',
          '오늘 최고 판이면 공유 안내 줄 visibility:hidden')
    check(page.evaluate("() => document.querySelector('#result img').alt") == '완성한 돌탑', '스냅샷 alt')
    check(page.evaluate("() => document.querySelector('#grid').textContent.split('\\n').map(r => [...r].length)") == [6, 6, 6, 6],
          '그리드 4행×6칸')
    check(text(page, '#result .share-btn') == f"오늘 최고 {v['H']:.1f}cm 공유", '공유 버튼 라벨')
    check(page.evaluate(GRADES) == [0, 1, 1, 2, 2, 3, 3, 4], '등급 경계 0.5B/1.0B/1.4B/1.8B')
    # S10a — 폴백 강제
    page.evaluate("() => window.__doltap.forceShare('fallback')")
    page.click('#result .share-btn')
    page.wait_for_selector('#dlg-share textarea')
    check(page.evaluate("() => document.querySelector('#dlg-share textarea').value") == '\n'.join(t), 'S10a textarea = shareText()')
    check(page.evaluate("() => document.querySelector('#dlg-share textarea').readOnly") is True, 'S10a readonly')
    check(text(page, '#dlg-share .copy-hint') == '길게 눌러 복사하세요', 'S10a 안내')
    page.click('#dlg-share button:has-text("닫기")')
    check(page.locator('#dlg-share').count() == 0 and page.is_visible('#result'), 'S10a 닫기 → S10')
    check(text(page, '#score .sub').startswith(f"({v['left']}/24) · "), f"점수 2줄 {text(page, '#score .sub')!r}")
    # 결과 화면에서 resize → 스냅샷 img는 그대로(탑은 #stage가 아닌 자체 스냅샷), R → 공식 2번째 판이 새로 그려진다
    page.set_viewport_size({'width': 360, 'height': 700})
    page.wait_for_timeout(300)
    check(page.evaluate(SHOWN), 'resize 뒤 S10 스냅샷 유지')
    page.keyboard.press('KeyR')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    page.wait_for_timeout(300)
    rv = page.evaluate('() => window.__doltap.view()')
    check(rv['mode'] == 'official' and page.is_visible('#stage') and not page.is_visible('#result'), f"R 재도전 {rv['mode']}")
    ink = page.evaluate("""() => { const c = document.getElementById('stage'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n; }""")
    check(ink > 100, f'재도전 판 캔버스 그려짐 {ink}')
    check(errors == [], f'console error {errors}')

if fails:
    print('FAIL e2e_s10')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_s10')
