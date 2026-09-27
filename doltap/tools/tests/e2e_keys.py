"""5단계 키보드: 이동 2px·가속, 회전, Backspace, 낙하 150ms 가드, 포커스 버튼 Space/Enter 차단
(preventDefault·stopPropagation 없음), Esc/P 일시정지, Q 2연타, M 음소거."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, boot_play, settle, view, finish

ARMED = "document.getElementById('skip').classList.contains('confirm')"   # 4a 훅 .hud-skip.confirm

with page_session(port=8800, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    boot_play(page)
    aim = lambda: view(page)['aim']
    state = lambda: page.evaluate('__doltap.state()')
    # 1) 누른 순간 2px, 계속 누르면 150ms 뒤 가속(600ms 유지 ≈ +105px)
    x0 = aim()['x']
    page.keyboard.press('ArrowRight')
    check(aim()['x'] == x0 + 2, f"+2px {aim()['x']}")
    page.keyboard.down('ArrowRight'); page.wait_for_timeout(600); page.keyboard.up('ArrowRight')
    dx = aim()['x'] - (x0 + 2)
    check(75 <= dx <= 140, f'accel dx {dx}')
    # 2) 회전 ↑/X/Z, Backspace는 x=195·각도 유지
    for key, want in (('ArrowUp', 15), ('x', 30), ('z', 15)):
        page.keyboard.press(key)
        check(aim()['aDeg'] == want, f'{key} → {aim()["aDeg"]}')
    page.keyboard.press('Backspace')
    check(aim()['x'] == 195 and aim()['aDeg'] == 15, f'backspace {aim()}')
    # 3) aim 진입 150ms 안의 Space는 무시, 그 뒤는 낙하
    page.evaluate('__doltap.drop()')
    check(settle(page), 'aim 2')
    page.keyboard.press('Space')
    check(state() == 'aim', 'drop guard 150ms')
    page.wait_for_timeout(200)
    # 4) 포커스된 ⏸에서 Space/Enter: 낙하만 되고 버튼은 활성화되지 않는다. window 버블 리스너까지 전파된다
    page.evaluate("""() => { window.__kd = [];
      addEventListener('keydown', e => __kd.push([e.code, e.defaultPrevented]));
      addEventListener('keyup', e => __kd.push([e.code + ':up', e.defaultPrevented]));
      document.getElementById('pause').focus(); }""")
    page.keyboard.press('Space')
    check(state() in ('drop', 'settle'), f'space drop → {state()}')
    page.keyboard.press('Enter')
    check(state() in ('drop', 'settle'), f'focused button activated → {state()}')
    kd = page.evaluate('__kd')
    for want in (['Space', True], ['Space:up', True], ['Enter', True], ['Enter:up', True]):
        check(want in kd, f'preventDefault/propagation {want} not in {kd}')
    page.evaluate('document.activeElement.blur()')
    check(settle(page), 'aim 3')
    page.wait_for_timeout(200)
    # 5) Esc → paused(1초 동안 stepsLeft 고정) → Esc → aim, P도 같다
    page.keyboard.press('Escape')
    s1 = view(page); page.wait_for_timeout(1000); s2 = view(page)
    check(s1['state'] == 'paused' and s1['aim']['stepsLeft'] == s2['aim']['stepsLeft'], 'pause freezes timer')
    page.keyboard.press('Escape')
    s3 = view(page)
    check(s3['state'] == 'aim' and 0 <= s2['aim']['stepsLeft'] - s3['aim']['stepsLeft'] <= 2, f'resume {s3["aim"]}')
    page.keyboard.press('p'); check(state() == 'paused', 'P pause')
    page.keyboard.press('p'); check(state() == 'aim', 'P resume')
    # 6) Q: 450ms 간격이면 재무장만, 100ms 간격이면 건너뛰기(판당 1회)
    slot = view(page)['slot']
    page.keyboard.press('q')
    check(page.evaluate(ARMED), 'armed')
    check(page.evaluate("document.getElementById('skip').textContent") == '한 번 더', 'skipConfirm text')
    page.wait_for_timeout(450)
    check(not page.evaluate(ARMED), 'armed cleared by hud.poll')
    page.keyboard.press('q')
    check(not view(page)['skipUsed'], 'late second tap only re-arms')
    page.wait_for_timeout(100); page.keyboard.press('q')
    v = view(page)
    check(v['skipUsed'] and v['slot'] == slot + 1, f'Q double → skip {v["slot"]}')
    check(page.evaluate("document.getElementById('skip').getAttribute('aria-disabled')") == 'true', 'aria-disabled')
    page.wait_for_timeout(200)
    page.keyboard.press('q'); page.wait_for_timeout(100); page.keyboard.press('q')
    check(view(page)['slot'] == slot + 1, 'skip once per run')
    # 7) M: 음소거 토글과 저장
    page.keyboard.press('m')
    check(page.evaluate('__doltap.store().sound') is False, 'mute saved')
    page.keyboard.press('m')
    check(page.evaluate('__doltap.store().sound') is True, 'unmute saved')
    finish('keys', errors)
