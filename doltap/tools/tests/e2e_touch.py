"""5단계 터치 규칙: 120ms 탭 무시·상대 드래그·80ms 떼기 보정·취소 존/힌트·pointercancel·
바 시작 무시·aim 전 누름 무시·↻ 홀드 반복. CDP Input.dispatchTouchEvent(has_touch 컨텍스트)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, boot_play, settle, view, finish

with page_session(port=8799, viewport=(390, 844), path='/doltap/', query='', has_touch=True) as (page, errors):
    cdp = page.context.new_cdp_session(page)

    def touch(kind, x=0, y=0):
        pts = [] if kind in ('touchEnd', 'touchCancel') else [{'x': x, 'y': y, 'id': 1}]
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})

    def drag(path):
        for x, y in path:
            touch('touchMove', x, y)
            page.wait_for_timeout(16)

    X = lambda: view(page)['aim']['x']
    slot = lambda: view(page)['slot']
    state = lambda: page.evaluate('__doltap.state()')
    hint_hidden = lambda: page.evaluate("document.getElementById('cancelHint').hidden")

    boot_play(page)
    # 1) 120ms 미만 탭은 무시
    touch('touchStart', 200, 400); page.wait_for_timeout(40); touch('touchEnd')
    page.wait_for_timeout(50)
    check(state() == 'aim' and slot() == 1, 'short tap ignored')
    # 2) 상대 드래그: 손가락 100→160(+60 css) → 돌 195→255 (k=1)
    touch('touchStart', 100, 400)
    drag([(120, 400), (140, 400), (160, 400)])
    check(abs(X() - 255) < 1e-9, f'relative drag {X()}')
    # 3) 80ms 보정: 150ms 멈췄다가 +100 튕기고 곧바로 떼면 멈춘 위치(255)로 낙하
    page.wait_for_timeout(150)
    touch('touchMove', 260, 400); touch('touchEnd')
    check(settle(page), 'aim after drop')
    ld = page.evaluate('__doltap.lastDrop()')
    check(abs(ld['x'] - 255) < 1e-9, f'80ms correction {ld}')
    check(slot() == 2, 'slot 2')
    page.wait_for_timeout(200)
    # 4) 바 위 40px 안에서 힌트, 바(y ≥ 694)에 들어가면 취소하고 누른 시점 x(195)로
    touch('touchStart', 100, 400)
    drag([(160, 400), (160, 670)])
    check(not hint_hidden(), 'cancel hint shown')
    drag([(160, 720)])
    check(X() == 195 and hint_hidden(), f'bar cancel {X()}')
    touch('touchEnd'); page.wait_for_timeout(50)
    check(state() == 'aim' and slot() == 2, 'no drop after cancel')
    # 5) pointercancel → 원위치
    touch('touchStart', 100, 400)
    drag([(150, 400)])
    check(X() == 245, f'drag 245 {X()}')
    touch('touchCancel'); page.wait_for_timeout(50)
    check(X() == 195 and slot() == 2 and state() == 'aim', 'pointercancel restore')
    # 6) 하단 바에서 시작한 누름은 버튼이 아니면 무시
    touch('touchStart', 200, 760)
    drag([(260, 760)])
    page.wait_for_timeout(200); touch('touchEnd'); page.wait_for_timeout(50)
    check(X() == 195 and slot() == 2 and state() == 'aim', 'bar start ignored')
    # 7) aim 진입 전(drop 중)에 누른 손가락은 aim에서 무시(규칙 8)
    page.evaluate('__doltap.drop()')
    touch('touchStart', 100, 400)
    check(settle(page), 'aim 3')
    page.wait_for_timeout(200)
    drag([(160, 400)]); touch('touchEnd'); page.wait_for_timeout(50)
    check(X() == 195 and slot() == 3 and state() == 'aim', 'pre-aim pointer ignored')
    # 8) ↻ 짧은 탭 = 즉시 1스텝(15°), 400ms 홀드 = 즉시 1 + 350ms 반복 1 = 2스텝(+30° → 45°)
    check(view(page)['aim']['aDeg'] == 0, 'aDeg 0')
    box = page.locator('#rotCw').bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    touch('touchStart', cx, cy); touch('touchEnd'); page.wait_for_timeout(50)
    check(view(page)['aim']['aDeg'] == 15, f"tap → {view(page)['aim']['aDeg']}")
    touch('touchStart', cx, cy); page.wait_for_timeout(400); touch('touchEnd'); page.wait_for_timeout(50)
    check(view(page)['aim']['aDeg'] == 45, f"hold repeat → {view(page)['aim']['aDeg']}")
    check(page.evaluate('document.activeElement.id') != 'rotCw', 'rotCw took focus')
    finish('touch', errors)
