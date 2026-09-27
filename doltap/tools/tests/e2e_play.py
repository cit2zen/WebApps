"""e2e_play — §8 4~15단계: 골든·공식 진입·실입력 첫 낙하·레이아웃(390×844 스크린샷)·회전·키보드·각도 정합·일시정지·백그라운드·가로·건너뛰기."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8807                                               # interfaces §A: e2e_play 전용 포트
SHOTS = os.environ.get('DOLTAP_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))  # 기본 tools/tests/out(gitignore)
os.makedirs(SHOTS, exist_ok=True)
GOLD = {'type': 'flat', 'attempts': 1, 'tone': 'stone-ochre-d', 'moss': 0, 'r0': 38.56796620134264,
        'r': 38.09872508937638, 's': 0.6031809794064611,
        'verts': [[-37.13, -3.62], [-33.85, -14.43], [-2.84, -24.17], [23.14, -16.01], [35.53, -4.25],
                  [22.22, 19.81], [-2.08, 22.84], [-30.63, 17.11]]}                       # §5 실례 1
PIXEL = """([x, y]) => { const d = Math.min(devicePixelRatio, 2);
  return [...document.querySelector('#stage').getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data]; }"""
SEEN = """s => [...document.querySelectorAll('body *')].some(e => e.children.length === 0 && e.textContent.includes(s)
  && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0')"""
VIS = """v => { for (const [k, x] of [['visibilityState', v ? 'visible' : 'hidden'], ['hidden', !v]])
  Object.defineProperty(document, k, { value: x, configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }"""
SKIP = """() => [...document.querySelectorAll('#game button')].find(b => b.getAttribute('aria-label') === '건너뛰기'
  || b.textContent.includes('건너뛰기'))"""
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def hook(page, expr):
    return page.evaluate(f'async () => window.__doltap.{expr}')


def text(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); return e ? e.textContent : null; }', sel)


def near(rgba, hexcol, tol):
    h = hexcol.strip().lstrip('#')
    return rgba[3] == 255 and all(abs(rgba[i] - int(h[2 * i:2 * i + 2], 16)) <= tol for i in range(3))


def token(page, name):
    return page.evaluate('n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()', name)


def tone_token(tone):
    return '--doltap-' + re.sub(r'-d$', '-dk', re.sub(r'-l$', '', tone))


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    # 4 — 저장 비우고 재로드, 10월 1일로 덮어쓰기
    hook(page, 'wipe()')
    page.reload()
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=10000)
    page.set_viewport_size({'width': 390, 'height': 844})
    hook(page, "setToday('20261001')")
    check(text(page, '#lobby-sub') == '#1 · 10월 1일 · 달빛암 앞 돌길', f"4 부제 {text(page, '#lobby-sub')!r}")
    check(text(page, '#card-today .pol-num') == '오늘의 돌탑 #1 (10월 1일)', '4 번호 줄')
    ds = hook(page, "daily('20261001')")
    check(ds['seed'] == 1568161157, f"4 seed {ds['seed']}")
    check(''.join(s['type'][0].upper() for s in ds['stones']) == 'FAFFARRFAAFAAWRAAWWAWAWR', '4 유형열')
    # 5 — 골든 실례 1
    g = ds['stones'][0]
    check(all(g[k] == GOLD[k] for k in ('verts', 'type', 'attempts', 'tone', 'moss')), '5 verts·type·attempts·tone·moss')
    check(all(abs(g[k] - GOLD[k]) < 1e-9 for k in ('r0', 'r', 's')), '5 r0·r·s |Δ|<1e-9')
    # 6 — 튜토리얼 켜고 오늘 카드 → S7
    hook(page, 'tut(false)')
    page.wait_for_timeout(1000)
    page.click('#card-today')
    page.wait_for_function("() => window.__doltap.state() === 'aim'")
    page.wait_for_timeout(100)
    v, L = hook(page, 'view()'), hook(page, 'layout()')
    check((v['mode'], v['n'], v['slot'], v['candles'], v['skipUsed']) == ('official', 1, 1, 3, False), f'6 view {v}')
    check(abs(L['rockScreenY'] - (v['Y'] + 180) * L['k'] - 514) < 1e-6, '6 첫 스폰 y 514')
    check(page.evaluate(SEEN, '👆'), '6 손가락 고스트 표시')
    day = hook(page, "store().days['20261001']")
    check(day is None or day.get('tries') == 0, f'6 첫 낙하 전 차감 없음 {day}')
    # 7 — 실입력(마우스 절대 매핑·좌클릭 낙하)
    page.mouse.move(200, 400)
    page.wait_for_timeout(200)
    x0 = hook(page, 'view().aim.x')
    page.mouse.down()
    page.mouse.up()
    u = hook(page, "until('aim', 400)")
    v, st = hook(page, 'view()'), hook(page, 'store()')
    check(x0 == 200 and u['ok'], f'7 x0 {x0} until {u}')
    check(v['slot'] == 2 and st['days']['20261001']['tries'] == 1 and st['tutDone'] is True, '7 slot 2·tries 1·tutDone')
    page.wait_for_timeout(150)
    check(not page.evaluate(SEEN, '👆'), '7 고스트 사라짐')
    if hook(page, 'audio()') != 'running':                # 헤드리스 정책 우회: keydown unlock 경로(§8 자동화 우회)
        page.keyboard.press('m')
        page.keyboard.press('m')
    check(hook(page, 'audio()') == 'running', '7 AudioContext running')
    check(text(page, '#height') == f"{hook(page, 'height()'):.1f}cm", '7 HUD 높이 텍스트')
    # 8 — 레이아웃 + 필수 스크린샷 + 픽셀 표본
    L, v = hook(page, 'layout()'), hook(page, 'view()')
    check((L['k'], L['rockScreenY'], L['landscape'], v['camOff']) == (1, 694, False, 0), f'8 layout {L}')
    page.screenshot(path=os.path.join(SHOTS, 'doltap_s7_390x844.png'))
    check(near(page.evaluate(PIXEL, [195, 700]), token(page, '--doltap-rock'), 24), '8 바위 영역(195,700) 색')
    hang = page.evaluate(PIXEL, [v['aim']['x'], 694 - (v['Y'] + 180)])
    check(near(hang, token(page, tone_token(ds['stones'][v['slot'] - 1]['tone'])), 40), f'8 매달린 돌 y 색 {hang}')
    # 9 — 회전 버튼 ↻ 2회, ↺ 1회
    check(v['aim']['aDeg'] == 0, '9 새 돌 aDeg 0')
    page.click('button[aria-label="시계 방향 15도"]')
    page.click('button[aria-label="시계 방향 15도"]')
    a1 = hook(page, 'view().aim.aDeg')
    page.click('button[aria-label="반시계 방향 15도"]')
    check(a1 == 30 and hook(page, 'view().aim.aDeg') == 15, f'9 aDeg {a1}→15')
    # 10 — 키보드 → 이동 2px, Space 낙하
    x1 = hook(page, 'view().aim.x')
    page.keyboard.press('ArrowRight')
    check(abs(hook(page, 'view().aim.x') - x1 - 2) < 1e-9, '10 ArrowRight 2px')
    page.keyboard.press('Space')
    u = hook(page, "until('aim', 400)")
    ld = hook(page, 'lastDrop()')
    check(u['ok'] and ld['aDeg'] == 15 and ld['maxVertErr'] <= 0.05, f'10 lastDrop {ld}')
    check(hook(page, 'view().aim.aDeg') == 0, '10 다음 돌 aDeg 0')
    # 11 — 각도 정합 90·195
    for a in (90, 195):
        ld = hook(page, f'aim(195, {a}) && window.__doltap.drop() && window.__doltap.lastDrop()')
        u = hook(page, "until('aim', 400)")
        check(ld['aDeg'] == a and ld['maxVertErr'] <= 0.05 and u['ok'], f'11 aDeg {a}: {ld} {u}')
    # 12 — Escape 일시정지·재개, stepsLeft 유지
    page.keyboard.press('Escape')
    check(hook(page, 'state()') == 'paused' and text(page, '#dlg-pause h2') == '잠깐 쉬는 중', '12 S9')
    check(re.fullmatch(r'\d+\.\dcm · \d{1,2}/24', text(page, '#dlg-pause .pause-status') or '') is not None, '12 상태 줄')
    s1 = hook(page, 'view().aim.stepsLeft')
    page.wait_for_timeout(1000)
    s2 = hook(page, 'view().aim.stepsLeft')
    page.keyboard.press('Escape')
    s3 = hook(page, 'view().aim.stepsLeft')                # 재개 직후 프레임이 1~2스텝 돌 수 있다
    check(hook(page, 'state()') == 'aim' and s1 == s2 and s2 - 3 <= s3 <= s2, f'12 stepsLeft {s1} {s2} {s3}')
    # 13 — visibilitychange hidden → paused·suspended, visible이어도 유지, 계속 → aim·running
    page.evaluate(VIS, False)
    page.wait_for_timeout(100)
    check(hook(page, 'state()') == 'paused' and hook(page, 'audio()') == 'suspended', '13 hidden')
    page.evaluate(VIS, True)
    page.wait_for_timeout(100)
    check(hook(page, 'state()') == 'paused', '13 visible이어도 자동 재개 없음')
    page.click('#dlg-pause .pol-btn-primary')
    page.wait_for_function("() => window.__doltap.audio() === 'running'", timeout=3000)  # resume()은 비동기 — 부하 시 100ms 초과
    check(hook(page, 'state()') == 'aim' and hook(page, 'audio()') == 'running', '13 계속')
    # 14 — 가로 화면 → paused + 오버레이, 세로 복귀 뒤에도 paused, 바위 픽셀 복원
    page.set_viewport_size({'width': 844, 'height': 390})
    page.wait_for_timeout(300)
    L = hook(page, 'layout()')
    check(L['landscape'] is True and abs(L['k'] - (390 - 256) / 237.5) < 1e-3, f'14 layout {L}')
    check(page.evaluate(SEEN, '세로로 돌려 주세요') and hook(page, 'state()') == 'paused', '14 오버레이·paused')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    check(hook(page, 'state()') == 'paused', '14 세로 복귀 뒤 paused 유지')
    check(near(page.evaluate(PIXEL, [195, 700]), token(page, '--doltap-rock'), 24), '14 재그리기(바위 픽셀)')
    page.screenshot(path=os.path.join(SHOTS, 'doltap_s9_after_landscape.png'))
    page.click('#dlg-pause .pol-btn-primary')
    check(hook(page, 'state()') == 'aim', '14 계속 → aim')
    # 15 — 건너뛰기 2연타(100ms) → 1회 사용, 두 번째 2연타는 무시
    skip, s0 = page.evaluate_handle(SKIP).as_element(), hook(page, 'view().slot')
    skip.click()
    page.wait_for_timeout(100)
    skip.click()
    page.wait_for_timeout(50)
    v = hook(page, 'view()')
    check(v['skipUsed'] is True and v['slot'] == s0 + 1 and skip.get_attribute('aria-disabled') == 'true', f'15 1회차 {v["slot"]}')
    skip.click(force=True)                                # aria-disabled 버튼은 actionability 대기에 걸리므로 강제 클릭으로 무시 여부만 본다
    page.wait_for_timeout(100)
    skip.click(force=True)
    page.wait_for_timeout(50)
    check(hook(page, 'view().slot') == s0 + 1, '15 판당 1회')
    check(errors == [], f'console error {errors}')

if fails:
    print('FAIL e2e_play')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_play')
