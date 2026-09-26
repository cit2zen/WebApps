"""5단계 일시정지·오디오: 제스처 unlock, visibilitychange hidden → paused+suspended(자동 재개 없음),
가로 화면 오버레이·paused 유지·resize 재그리기, debug pause/resume/speed/mute.
최종 리뷰 #1: 가로 오버레이(#portrait)가 S9(.pol-overlay 200) 위 최상단 — 화면 중앙 elementFromPoint = #portrait,
세로 복귀 뒤 오버레이 숨김 + S9 '계속' 클릭으로 재개, 가로에서 로비로 나가면 오버레이도 숨는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, wait_lobby, boot_play, settle, finish

VIS = """v => { Object.defineProperty(document, 'visibilityState', {value: v ? 'visible' : 'hidden', configurable: true});
  Object.defineProperty(document, 'hidden', {value: !v, configurable: true});
  document.dispatchEvent(new Event('visibilitychange')); }"""
PIXEL = """() => { const d = Math.min(devicePixelRatio, 2);
  return [...document.querySelector('#stage').getContext('2d').getImageData(Math.round(195 * d), Math.round(700 * d), 1, 1).data]; }"""
PORTRAIT_HIDDEN = "document.getElementById('portrait').hidden"
ON_TOP = """() => { const p = document.getElementById('portrait'), e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  return !!e && (e === p || p.contains(e)); }"""
S9_OPEN = "() => !!document.getElementById('dlg-pause')"
S9_RESUME = '#dlg-pause .pol-btn-primary'
S9_LOBBY = '#dlg-pause .pol-dialog > button:last-child'
SHOWN = "() => getComputedStyle(document.getElementById('portrait')).display !== 'none'"

with page_session(port=8801, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    state = lambda: page.evaluate('__doltap.state()')
    audio = lambda: page.evaluate('__doltap.audio()')
    wait_lobby(page)
    check(audio() == 'none', 'no AudioContext before gesture')
    boot_play(page)
    # 1) 실제 마우스 제스처: 낙하 + pointerup/click unlock → running
    page.mouse.move(200, 400); page.mouse.down(); page.mouse.up()
    page.wait_for_function("() => __doltap.audio() === 'running'", timeout=2000)
    check(settle(page), 'aim after gesture drop')
    # 2) hidden → paused + suspended, visible → 자동 재개 없음, Esc(사용자 활성화)로 재개 → running
    page.evaluate(VIS, False); page.wait_for_timeout(100)
    check(state() == 'paused' and audio() == 'suspended', f'hidden → {state()} {audio()}')
    page.evaluate(VIS, True); page.wait_for_timeout(100)
    check(state() == 'paused', 'no auto resume on visible')
    page.keyboard.press('Escape')
    page.wait_for_function("() => __doltap.audio() === 'running'", timeout=2000)
    check(state() == 'aim', 'resume → aim')
    # 3) 가로 화면(k < 0.75) → 오버레이 + paused, 가로에서는 재개 거부, 세로 복귀 후에도 paused, 바위 재그리기
    page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
    L = page.evaluate('__doltap.layout()')
    check(L['landscape'] and state() == 'paused' and not page.evaluate(PORTRAIT_HIDDEN), f'landscape {L}')
    check(page.evaluate(S9_OPEN) and page.evaluate(ON_TOP), 'portrait above S9 (rotate mid-run)')
    page.mouse.click(422, 195); page.wait_for_timeout(100)             # 중앙 클릭은 오버레이가 받는다(S9 계속 아님)
    check(state() == 'paused', 'center click in landscape does not resume')
    page.keyboard.press('Escape')
    check(state() == 'paused', 'no resume while landscape')
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(300)
    check(state() == 'paused' and page.evaluate(PORTRAIT_HIDDEN) and not page.evaluate(SHOWN), 'portrait back, still paused')
    px = page.evaluate(PIXEL)
    check(px[3] == 255 and all(abs(px[i] - c) <= 24 for i, c in enumerate((0x7b, 0x76, 0x6b))), f'rock pixel {px}')
    page.click(S9_RESUME); page.wait_for_timeout(100)
    check(state() == 'aim', 'S9 계속 click → resume after portrait')
    # 4) 훅: pause/resume/speed/mute
    check(page.evaluate('__doltap.pause()') == 'paused', 'hook pause')
    check(page.evaluate('__doltap.resume()') == 'aim', 'hook resume')
    check(page.evaluate('[__doltap.speed(8), __doltap.speed(3), __doltap.speed(1)]') == [8, 8, 1], 'speed')
    check(page.evaluate('__doltap.mute(true)') is True and page.evaluate('__doltap.store().sound') is False, 'mute')
    check(page.evaluate('__doltap.mute(false)') is False and page.evaluate('__doltap.store().sound') is True, 'unmute')
    # 5) 가로 상태에서 새 판 시작 → 곧바로 오버레이 + paused, 재개 거부 / 세로 복귀 뒤 재개 허용(§4 k < 0.75)
    page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
    st = page.evaluate("() => { __doltap.start('practice', {day: '20261001'}); return __doltap.state(); }")
    check(st == 'paused' and not page.evaluate(PORTRAIT_HIDDEN), f'landscape start → {st}')
    check(page.evaluate(S9_OPEN) and page.evaluate(ON_TOP), 'portrait above S9 (landscape start)')
    page.keyboard.press('Escape')
    check(state() == 'paused' and page.evaluate('__doltap.resume()') == 'paused', 'no resume in landscape start')
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(300)
    check(state() == 'paused' and page.evaluate(PORTRAIT_HIDDEN) and not page.evaluate(SHOWN), 'portrait back after landscape start')
    page.click(S9_RESUME); page.wait_for_timeout(100)
    check(state() == 'aim', 'S9 계속 click → resume after landscape start')
    # 6) 가로에서 S9 '로비로'(키보드 등)로 나가면 #game과 함께 오버레이도 숨는다
    page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
    check(state() == 'paused' and page.evaluate(SHOWN), 'landscape again → overlay shown')
    page.evaluate(f"() => document.querySelector('{S9_LOBBY}').click()")
    wait_lobby(page)
    check(not page.evaluate(SHOWN), 'overlay hidden in lobby (landscape)')
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(300)
    finish('pause', errors)
