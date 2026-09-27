"""e2e_physics — physics.js(실제 Matter 0.20)·convexCheck·stats 검증 (구현 3단계). 포트 8793."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')

PROBE = """async () => {
  const P = await import(new URL('js/physics.js', location.href).href);
  const D = await import(new URL('js/daily.js', location.href).href);
  const W = P.createWorld();
  const out = { minY: W.rock.bounds.min.y, rx: W.rock.position.x, ry: W.rock.position.y,
    ray195: W.rayDown(195).y, ray100: W.rayDown(100).y, ray50: W.rayDown(50),
    rayIsRock: W.rayDown(195).body === W.rock };
  const set = D.daily('20261001');
  const b = W.dropStone(set.stones[0], 195, 180, 15);
  out.angle = b.angle; out.px = b.position.x; out.py = b.position.y; out.slot = b.slot;
  out.n1 = W.stones().length; out.rayStone = W.rayDown(195).body === b;
  let steps = 0; while (!b.isSleeping && steps < 2000) { W.step(); steps++; }
  out.sleep1 = b.isSleeping; out.sleepSteps = steps;
  let woke = null;
  W.onFirstContact(nb => { woke = { isNew: nb !== b, others: W.stones().filter(s => s !== nb).map(s => s.isSleeping) }; });
  W.dropStone(set.stones[1], 195, 180 + 60, 0);
  for (let k = 0; k < 200 && !woke; k++) W.step();
  out.woke = woke;
  W.remove(b); out.n2 = W.stones().length;
  W.destroy();
  return out;
}"""

with page_session(port=8793, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    r = page.evaluate(PROBE)
    print(json.dumps(r))
    assert abs(r['minY']) <= 0.01, f"rock bounds.min.y={r['minY']}"
    assert abs(r['rx'] - 195) < 1e-6 and abs(r['ry'] - 74.0477) < 1e-3, (r['rx'], r['ry'])
    assert abs(r['ray195']) < 1e-9 and r['rayIsRock'], r['ray195']
    assert abs(r['ray100'] - (-5.5)) < 1e-9, r['ray100']
    assert r['ray50'] is None, r['ray50']
    assert r['angle'] == 15 * 3.141592653589793 / 180, r['angle']
    assert abs(r['px'] - 195) < 1e-9 and abs(r['py'] - (-180)) < 1e-9, (r['px'], r['py'])
    assert r['slot'] == 1 and r['n1'] == 1 and r['rayStone']
    assert r['sleep1'], f"stone 1 never slept ({r['sleepSteps']} steps)"
    assert r['woke'] and r['woke']['isNew'] and r['woke']['others'] == [False], r['woke']
    assert r['n2'] == 1
    cc = page.evaluate("() => __doltap.convexCheck('20261001', 365)")
    print('convexCheck', cc)
    assert cc == {'stones': 8760, 'reHulled': 0}, cc
    st = page.evaluate('() => __doltap.stats()')
    assert st['reHulled'] == 0, st
    assert errors == [], errors
print('PASS e2e_physics')
