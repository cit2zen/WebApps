"""5단계 계약 확인: Task 0~4 모듈이 레지스트리 B의 정본 export·core payload·DOM을 갖췄는지 본다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, wait_lobby, finish

WANT = {
    'core.js': ['createRun'],
    'physics.js': ['createWorld', 'reHulled'],
    'daily.js': ['daily', 'todayKST', 'nOf', 'setToday', 'addDays'],
    'stones.js': ['generate', 'rotCW', 'centroid'],
    'rng.js': ['fnv'],
    'storage.js': ['load', 'set', 'bumpTries', 'commitResult', 'wipe'],
    'content.js': ['load', 'pick'],
    'theme.js': ['loadTheme', 'safeTop', 'fitCanvas'],
    'camera.js': ['layout', 'createCamera', 'camTarget'],
    'scene.js': ['attach', 'resize', 'draw', 'drawMs', 'caches', 'lowPoint'],
    'fx.js': ['update', 'burst', 'count', 'clear'],
    'flags.js': ['reset', 'crossed', 'popup'],
    'render.js': ['drawStoneThumb'],
    'dom.js': ['h', 'setText', 'fmt', 'setAria'],
    'debug.js': ['install', 'pickSet'],
    'game.js': ['init', 'resize', 'setScreen', 'state', 'running', 'start', 'step', 'frame',
                'dispatch', 'view', 'layout', 'height', 'seed', 'stats'],
}
HUD_KEYS = ['skip', 'skipConfirm', 'cancelHint', 'portrait', 'subFriend', 'subBest', 'hold', 'rotCw', 'rotCcw', 'pause']

JS = """async ([want, hudKeys]) => {
  const miss = [];
  for (const [f, names] of Object.entries(want)) {
    const m = await import(`/doltap/js/${f}`);
    for (const n of names) if (typeof m[n] !== 'function') miss.push(`${f}:${n}`);
  }
  const S = (await import('/doltap/js/strings.js')).default;
  for (const k of hudKeys) if (typeof (S.hud || {})[k] !== 'string') miss.push(`strings.hud.${k}`);
  // physics: W.dropStone은 교체 가능한 일반 속성(gametest.hookDrop이 감싼다)
  const W = (await import('/doltap/js/physics.js')).createWorld();
  const d = Object.getOwnPropertyDescriptor(W, 'dropStone');
  if (typeof W.dropStone !== 'function' || !Object.isExtensible(W) || (d && !d.writable)) miss.push('W.dropStone 교체 불가');
  for (const n of ['stones', 'destroy', 'rayDown']) if (typeof W[n] !== 'function') miss.push(`W.${n}`);
  // core: aim.next = 1-based 슬롯 번호, 첫 aim은 첫 step/dispatch에서 emit, 모르는 이벤트는 throw
  const { createRun } = await import('/doltap/js/core.js');
  const set = (await import('/doltap/js/daily.js')).daily('20261001');
  const R = createRun(set, { mode: 'practice', W });
  let aim = null;
  R.on('aim', p => { aim = p; });
  R.step();
  if (!aim || JSON.stringify(aim.next) !== '[2,3]' || aim.slot !== 1) miss.push(`aim payload ${JSON.stringify(aim)}`);
  try { R.on('nope', () => {}); miss.push('R.on 모르는 이벤트 허용'); } catch { /* 기대 */ }
  W.destroy();
  // camera: layout(w, h, safeTop) 순수 + createCamera
  const cam = await import('/doltap/js/camera.js');
  const L = cam.layout(390, 844, 0);
  for (const k of ['k', 'ox', 'rockScreenY', 'landscape']) if (!(k in L)) miss.push(`layout().${k}`);
  const c = cam.createCamera(L);
  for (const n of ['setLayout', 'setHeight', 'track', 'snap']) if (typeof c[n] !== 'function') miss.push(`cam.${n}`);
  for (const id of ['boot', 'error', 'lobby', 'game', 'result', 'stage']) if (!document.getElementById(id)) miss.push('#' + id);
  if (!document.querySelector('#game #stage')) miss.push('#stage는 #game 안');
  return miss;
}"""

with page_session(port=8797, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    wait_lobby(page)
    miss = page.evaluate(JS, [WANT, HUD_KEYS])
    check(miss == [], f'계약 누락: {miss}')
    finish('iface', errors)
