import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
# #stage backing 픽셀(css 좌표 → dpr 배율) RGBA
PX = ("([x, y]) => { const c = document.querySelector('#stage'), d = c.width / innerWidth;"
      " return Array.from(c.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data); }")
TOK = "n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()"
FRAMES = "n => new Promise(r => { const f = k => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); })"


def rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def near(a, b, tol=3):
    return all(abs(a[i] - b[i]) <= tol for i in range(3))


with page_session(port=8795, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    page.wait_for_function("() => window.__doltap.state() === 'lobby'", timeout=8000)
    s = page.evaluate("() => { const s = __doltap.start('practice', {day: '20261001'}); return {seed: s.seed, n: s.n}; }")
    assert s == {'seed': 1568161157, 'n': 1}, s
    page.evaluate(FRAMES, 3)
    assert page.evaluate("__doltap.state()") == 'aim'
    assert page.is_visible('#game') and page.is_hidden('#lobby') and page.is_hidden('#boot')

    # 1) 레이아웃·스폰 식: 바위 694, 첫 스폰 514 (k=1, camOff 0)
    L = page.evaluate("__doltap.layout()")
    ih = page.evaluate("innerHeight")
    assert L['rockScreenY'] == ih - 150 == 694, L
    assert L['k'] == 1 and L['landscape'] is False and L['camOff'] == 0, L
    v = page.evaluate("__doltap.view()")
    assert v['mode'] == 'practice' and v['day'] == '20261001' and v['slot'] == 1, v
    assert v['Y'] == 0 and v['aim']['x'] == 195 and v['aim']['aDeg'] == 0 and v['bodies'] == [], v
    assert L['rockScreenY'] - (v['Y'] + 180 - v['camOff']) * L['k'] == 514

    # 2) 픽셀: 바 전체(y ≥ 694)가 --doltap-rock, 바로 위(690)는 능선
    rock = rgb(page.evaluate(TOK, '--doltap-rock'))
    for p in ([60, 697], [20, 760], [370, 760], [195, 700], [300, 835]):
        assert near(page.evaluate(PX, p), rock), (p, page.evaluate(PX, p), rock)
    assert not near(page.evaluate(PX, [60, 690]), rock, 10), page.evaluate(PX, [60, 690])
    page.screenshot(path=os.path.join(OUT, 'task4_390x844.png'))

    # 3) 매달린 돌이 (195, 514)에 있다: x를 60으로 옮기면 그 픽셀이 (60, 514)로 따라간다
    before, ctrl = page.evaluate(PX, [195, 514]), page.evaluate(PX, [195, 380])
    page.evaluate("__doltap.dispatch({t: 'setX', x: 60})")
    page.evaluate(FRAMES, 3)
    assert not near(page.evaluate(PX, [195, 514]), before, 6), '돌이 떠난 자리는 배경'
    assert near(page.evaluate(PX, [60, 514]), before, 2), (page.evaluate(PX, [60, 514]), before)
    assert near(page.evaluate(PX, [195, 380]), ctrl, 2), '배경은 그대로'

    # 4) rAF 고정 스텝 루프: aim 타이머가 실시간 1초에 약 60스텝 줄어든다
    a = page.evaluate("__doltap.view().aim.stepsLeft")
    page.wait_for_timeout(1000)
    b = page.evaluate("__doltap.view().aim.stepsLeft")
    assert 40 <= a - b <= 80, (a, b)

    # 5) dispatch·until·step·height·seed·stats: 낙하 → 착지 흙먼지 → 다음 aim
    r = page.evaluate("""async () => {
      __doltap.dispatch({t: 'setX', x: 195});
      __doltap.dispatch({t: 'drop'});
      const u = await __doltap.until('aim', 2400);
      return {u, v: __doltap.view(), st: __doltap.stats(), h: __doltap.height(), seed: __doltap.seed()};
    }""")
    assert r['u']['ok'] and r['u']['state'] == 'aim' and r['u']['steps'] > 0, r['u']
    assert r['v']['slot'] == 2 and len(r['v']['bodies']) == 1 and r['v']['bodies'][0]['i'] == 1, r['v']
    assert r['h'] > 0 and r['seed'] == 1568161157, r
    assert r['st']['particles'] >= 12 and r['st']['caches'] >= 1 and r['st']['bodies'] == 2, r['st']
    assert page.evaluate("__doltap.step(5)") == 'aim'
    page.evaluate(FRAMES, 70)
    st = page.evaluate("__doltap.stats()")
    assert st['fps'] > 20 and 0 <= st['stepMs'] < 16 and 0 <= st['drawMs'] < 30, st
    assert st['particles'] == 0 and st['reHulled'] == 0, st

    # 6) resize: 360×640 → k=360/390, 바위 490, 바 재채색 → 390×844 복귀
    page.set_viewport_size({'width': 360, 'height': 640})
    page.evaluate(FRAMES, 3)
    L2 = page.evaluate("__doltap.layout()")
    assert abs(L2['k'] - 360 / 390) < 1e-9 and L2['rockScreenY'] == 490, L2
    assert near(page.evaluate(PX, [20, 600]), rock), page.evaluate(PX, [20, 600])
    page.screenshot(path=os.path.join(OUT, 'task4_360x640.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate(FRAMES, 3)
    assert page.evaluate("__doltap.layout()")['rockScreenY'] == 694
    assert near(page.evaluate(PX, [195, 700]), rock)

    assert errors == [], errors
print('PASS render')
