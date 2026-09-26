"""e2e_core — __doltap.core(day)·stats·state + 실제 Matter 위 core 1판 완주 (구현 3단계 완료 기준). 포트 8794."""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')

FULL_RUN = """async () => {
  const P = await import(new URL('js/physics.js', location.href).href);
  const D = await import(new URL('js/daily.js', location.href).href);
  const C = await import(new URL('js/core.js', location.href).href);
  const W = P.createWorld();
  const R = C.createRun(D.daily('20261001'), { mode: 'practice', W });
  const cnt = {}, heights = [];
  let holdReason = null;
  R.on('hold', p => { holdReason = p.reason; });
  for (const e of ['land','fall','perfect','combo0','milestone','stable','aim','skip','hold','holdTick','done','firstDrop','height'])
    R.on(e, p => { cnt[e] = (cnt[e] || 0) + 1; if (e === 'height') heights.push(p); });
  let steps = 0;
  while (R.view().state !== 'done' && steps < 24000) {
    if (R.view().state === 'aim') R.dispatch({ t: 'drop' });
    R.step(); steps++;
  }
  const out = { holdReason, steps, state: R.view().state, candles: R.view().candles, res: R.result(), cnt,
    hOk: heights.every(h => h.H === Math.round(5 * h.Y) / 10) };
  W.destroy();
  return out;
}"""

with page_session(port=8794, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    STATES = {'boot', 'error', 'lobby', 'aim', 'drop', 'settle', 'hold', 'paused', 'result'}
    s0 = page.evaluate('() => __doltap.state()')
    assert s0 in STATES, s0                                             # 3단계에서는 game이 없어 'boot'
    a = page.evaluate("() => __doltap.core('20261001')")
    assert a == {'slot': 2, 'candles': 3, 'state': 'aim'}, a
    b = page.evaluate("() => __doltap.core('20261001')")
    assert b == {'slot': 3, 'candles': 3, 'state': 'aim'}, b          # 같은 day → 이어서 1슬롯
    c = page.evaluate("() => __doltap.core('20261002', { x: 30 })")   # 바위(95~295) 밖 → 낙석
    assert c == {'slot': 2, 'candles': 2, 'state': 'aim'}, c
    st = page.evaluate('() => __doltap.stats()')
    assert st['reHulled'] == 0 and st['bodies'] == 1, st                # 돌 0 + 바위 1
    r = page.evaluate(FULL_RUN)
    print(json.dumps(r, ensure_ascii=False))
    res, g = r['res'], r['res']['grid']
    assert r['state'] == 'done' and r['steps'] < 24000, r['steps']
    assert len(g) == 24 and set(g) <= set('PSXE'), g
    assert res['left'] == g.count('P') + g.count('S') and res['perfect'] == g.count('P'), res
    assert res['fell'] == g.count('X') and res['H'] == math.floor(5 * res['Y'] + 0.5) / 10, res
    assert res['c'] == math.floor(res['H'] * 10 + 0.5) and r['hOk'], res
    assert r['cnt']['hold'] == 1 and r['cnt']['done'] == 1 and r['cnt']['holdTick'] == 2, r['cnt']
    assert r['cnt']['firstDrop'] == 1, r['cnt']
    if r['holdReason'] == 'candles':
        assert r['candles'] == 0, r
    else:
        assert r['holdReason'] == 'done' and r['candles'] > 0 and 'E' not in g, r
    assert errors == [], errors
print('PASS e2e_core')
