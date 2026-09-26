"""5단계 완료 기준: 마우스 낙하 · ↻ 2회 → aDeg 30 · lastDrop {15, 90, 195} maxVertErr ≤ 0.05 (+휠)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, boot_play, settle, view, finish

with page_session(port=8798, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    boot_play(page)
    # 1) hover 절대 매핑(k=1, ox=0), 하단 바 위 hover는 무시
    page.mouse.move(200, 400)
    page.wait_for_timeout(50)
    check(view(page)['aim']['x'] == 200, f"hover x {view(page)['aim']['x']}")
    page.mouse.move(300, 760)
    page.wait_for_timeout(50)
    check(view(page)['aim']['x'] == 200, 'bar hover ignored')
    # 2) 마우스 낙하: 누른 시간과 무관하게 뗀 순간 x
    page.mouse.move(120, 400)
    page.mouse.down()
    page.mouse.move(130, 400)
    page.mouse.up()
    st = page.evaluate('__doltap.state()')
    check(st in ('drop', 'settle'), f'mouse drop → {st}')
    check(settle(page), 'next aim')
    ld = page.evaluate('__doltap.lastDrop()')
    check(abs(ld['x'] - 130) < 1e-9, f'drop x {ld}')
    check(view(page)['slot'] == 2, 'slot 2')
    # 3) ↻ 2회 → 30, ↺ 1회 → 15, 버튼은 포커스를 받지 않는다
    check(view(page)['aim']['aDeg'] == 0, 'new stone aDeg 0')
    page.click('#rotCw')
    page.click('#rotCw')
    check(view(page)['aim']['aDeg'] == 30, f"rotCw x2 → {view(page)['aim']['aDeg']}")
    check(page.evaluate('document.activeElement.id') != 'rotCw', 'rotCw took focus')
    page.click('#rotCcw')
    check(view(page)['aim']['aDeg'] == 15, 'rotCcw → 15')
    # 4) 휠: 아래 +15, 80ms 안 두 번째는 무시, 위 −15
    page.mouse.move(200, 400)
    page.mouse.wheel(0, 100)
    page.mouse.wheel(0, 100)
    page.wait_for_timeout(30)
    check(view(page)['aim']['aDeg'] == 30, f"wheel throttle → {view(page)['aim']['aDeg']}")
    page.wait_for_timeout(120)
    page.mouse.wheel(0, -100)
    page.wait_for_timeout(30)
    check(view(page)['aim']['aDeg'] == 15, 'wheel up → 15')
    # 5) 각도 정합(§10 5단계 완료 기준)
    for a in (15, 90, 195):
        page.evaluate('a => __doltap.aim(195, a)', a)
        check(page.evaluate('__doltap.drop().ok'), f'drop {a}')
        check(settle(page), f'aim after {a}')
        r = page.evaluate('__doltap.lastDrop()')
        check(r['aDeg'] == a and r['maxVertErr'] <= 0.05, f'lastDrop {r}')
    finish('mouse', errors)
