"""e2e_lobby — 구현 6단계: S2 로비 · S3 · S4 · S5 · S6 · ?c=/?d= 배지 · XSS (Chromium 390×844)."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8803                                               # interfaces §A: e2e_lobby 전용 포트
BASE = f'http://127.0.0.1:{PORT}/doltap/'
XSS = '?c=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E'
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def text(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); return e ? e.textContent : null; }', sel)


def goto(page, q=''):
    page.goto(BASE + q)
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=10000)


SND = """() => { const b = document.querySelector('#lobby [data-snd]');
  return import('./js/audio.js').then(a => [b ? b.textContent : null, window.__doltap.store().sound, a.isMuted()]); }"""


def lobby_at(page, day):
    page.evaluate(f"() => window.__doltap.setToday('{day}')")
    page.wait_for_timeout(1000)                            # 로비 0~900ms 탭 무시 가드를 넘긴다


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    alerts = []
    page.on('dialog', lambda d: (alerts.append(d.message), d.dismiss()))
    page.evaluate('() => window.__doltap.wipe()')
    goto(page)
    lobby_at(page, '20261001')
    # S2
    check(page.locator('#lobby .pol-card').count() == 3, 'S2 카드 3장')
    check(page.locator('#lobby .pol-appbar button').count() == 3, 'S2 앱바 버튼 3개(🔊⚙?)')
    check(re.fullmatch(r'#1 · 10월 1일 · .+', text(page, '#lobby-sub') or '') is not None, f"S2 부제 {text(page, '#lobby-sub')!r}")
    check(text(page, '#card-today .pol-num') == '오늘의 돌탑 #1 (10월 1일)', 'S2 오늘 카드 번호 줄')
    check(text(page, '#card-today .today-chip') == '도전 0/3 · 탭해서 시작', 'S2 오늘 칩')
    check(page.evaluate("() => document.querySelector('#lobby-cards').classList.contains('open')"), 'S2 .open 펼침')
    # S3 — 10월 10일 기준 지난 7일 칩(D−1이 왼쪽 위)
    lobby_at(page, '20261010')
    page.click('#card-practice')
    page.wait_for_selector('#dlg-practice')
    chips = page.evaluate("() => [...document.querySelectorAll('#dlg-practice .chips7 .pol-chip')].map(b => b.textContent)")
    check(chips == ['10/9#9', '10/8#8', '10/7#7', '10/6#6', '10/5#5', '10/4#4', '10/3#3'], f'S3 칩 {chips}')
    page.keyboard.press('Escape')
    check(page.locator('#dlg-practice').count() == 0, 'S3 Esc로 닫힘')
    lobby_at(page, '20261001')
    page.click('#card-practice')
    page.wait_for_selector('#dlg-practice')
    check(page.locator('#dlg-practice .chips7 .pol-chip').count() == 0, 'S3 #1 날에는 지난 칩 0개(#N≥1만)')
    page.click('#dlg-practice button:has-text("닫기")')
    # S4 — 기록 없음
    page.click('#card-record')
    page.wait_for_selector('#dlg-record')
    check('아직 쌓은 돌탑이 없어요' in (text(page, '#dlg-record') or ''), 'S4 빈 기록 문구')
    page.click('#dlg-record button:has-text("닫기")')
    check(page.evaluate("() => document.activeElement && document.activeElement.id") == 'card-record', 'S4 닫으면 포커스 반환')
    # S5 — 설정 저장·토스트
    page.click('#lobby .pol-appbar button[aria-label="설정"]')
    page.wait_for_selector('#dlg-settings')
    page.click('#dlg-settings [aria-label="소리"] button:has-text("끔")')
    check(page.evaluate('() => window.__doltap.store().sound') is False, 'S5 소리 끔 저장')
    check(page.evaluate(SND) == ['🔇', False, True], f'S5 끔 → 로비 🔊 아이콘 동기화 {page.evaluate(SND)}')
    page.click('#dlg-settings [aria-label="소리"] button:has-text("켬")')
    check(page.evaluate(SND) == ['🔊', True, False], f'S5 켬 → 로비 🔊 아이콘 동기화 {page.evaluate(SND)}')
    page.click('#dlg-settings [aria-label="손잡이"] button:has-text("왼손")')
    check(page.evaluate('() => window.__doltap.store().hand') == 'L', 'S5 손잡이 L 저장')
    page.click('#dlg-settings [aria-label="손잡이"] button:has-text("오른손")')
    page.click('#dlg-settings button:has-text("손가락 안내 다시 보기")')
    check(page.locator('.pol-toast', has_text='다음 판에 안내가 나와요').count() == 1, 'S5 토스트')
    check(page.evaluate('() => window.__doltap.store().tutDone') is False, 'S5 tutDone=false')
    page.keyboard.press('Escape')
    check(page.locator('#dlg-settings').count() == 0, 'S5 Esc로 닫힘')
    # 최종 리뷰 #3: 로비에서 M → 🔊 버튼이 음소거 표시, 버튼 클릭 = 현재 저장값 기준 토글(소리 켜짐)
    check(page.evaluate(SND) == ['🔊', True, False], f'M 전 {page.evaluate(SND)}')
    page.keyboard.press('m')
    check(page.evaluate(SND) == ['🔇', False, True], f'M → 음소거 표시 {page.evaluate(SND)}')
    page.click('#lobby [data-snd]')
    check(page.evaluate(SND) == ['🔊', True, False], f'🔊 클릭 → 소리 켜짐 {page.evaluate(SND)}')
    page.click('#lobby [data-snd]')
    check(page.evaluate(SND) == ['🔇', False, True], f'🔊 다시 클릭 → 음소거 {page.evaluate(SND)}')
    page.keyboard.press('m')
    check(page.evaluate(SND) == ['🔊', True, False], f'M 다시 → 소리 켜짐 {page.evaluate(SND)}')
    # S6 — 도움말 3장
    page.click('#lobby .pol-appbar button[aria-label="도움말"]')
    page.wait_for_selector('#dlg-help')
    cap = lambda: text(page, '#dlg-help .pol-caption') or ''   # noqa: E731
    check(cap().startswith('끌어서 맞추고, 떼면 쿵'), 'S6 1장 캡션')
    page.click('#dlg-help button:has-text("다음")')
    check(cap().startswith('↺↻ 15°씩 돌려'), 'S6 2장 캡션')
    page.keyboard.press('ArrowRight')
    check(cap().startswith('촛불 3개'), 'S6 3장(→ 키)')
    check(page.locator('#dlg-help button:has-text("다음")').is_disabled(), 'S6 마지막 장 다음 비활성')
    page.keyboard.press('Escape')
    check(page.locator('#dlg-help').count() == 0, 'S6 Esc로 닫힘')
    # ?c= 3종(정상·XSS·6자리) — 배지는 정상만, #lobby img 0, alert 없음
    for q, want in [('?c=1485', '친구 기록 148.5cm에 도전'), (XSS, None), ('?c=999999', None)]:
        goto(page, q)
        lobby_at(page, '20261001')
        chip = text(page, '#lobby-sub .pol-chip')
        check(chip == want, f'{q} 배지 {chip!r}')
        check(page.evaluate("() => document.querySelectorAll('#lobby img').length") == 0, f'{q} #lobby img 0개')
    # ③ 과거 날짜 + 친구 → 배지 버튼 → 그 날짜 연습
    goto(page, '?d=20260930&c=1485')
    lobby_at(page, '20261001')
    check(text(page, '#lobby-sub .badge') == '친구 9/30 돌탑 148.5cm · 연습 도전', f"③ 배지 {text(page, '#lobby-sub .badge')!r}")
    page.click('#lobby-sub .badge')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    v = page.evaluate('() => window.__doltap.view()')
    check(v['mode'] == 'practice' and v['day'] == '20260930', f"③ 과거 연습 진입 {v['mode']} {v['day']}")
    check(alerts == [], f'alert 발생 {alerts}')
    check(errors == [], f'console error {errors}')

if fails:
    print('FAIL e2e_lobby')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_lobby')
