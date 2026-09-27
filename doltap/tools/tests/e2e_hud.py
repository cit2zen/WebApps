"""5단계 HUD·게임 배선: 공식 판 고스트·첫 낙하 tries 차감·높이 텍스트·건너뛰기 버튼 2탭·
S8 카운트 3과 입력 잠금·결과 저장."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')
from playutil import check, wait_lobby, settle, view, finish

RUN_TO_HOLD = """() => { const {state, aim, drop, step, dispatch} = __doltap;
  for (let i = 0; i < 5000; i++) {
    if (state() === 'aim') { aim(195, 0); drop(); }
    const s = step(50);
    if (s === 'hold') {
      const c = document.querySelector('#count').textContent;
      const lock = document.getElementById('hud').classList.contains('hold');   // 4a 훅 #hud.hold
      dispatch({t: 'drop'});
      return {c, lock, st: state()};
    }
    if (s === 'result') return {err: 'hold 미관측'};
  }
  return {err: 'timeout'}; }"""

with page_session(port=8802, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    q = lambda js: page.evaluate(js)
    wait_lobby(page)
    q("() => { __doltap.wipe(); __doltap.setToday('20261001'); __doltap.tut(false); __doltap.start('official'); }")
    page.wait_for_timeout(200)
    v = view(page)
    check(v['state'] == 'aim' and v['mode'] == 'official' and v['slot'] == 1 and v['candles'] == 3 and not v['skipUsed'], f'start {v}')
    check(not q("document.getElementById('ghost').hidden"), 'ghost shown (tutDone=false)')
    check((q("__doltap.store().days['20261001']") or {}).get('tries', 0) == 0, 'no tries before first drop')
    check(q("document.getElementById('height').textContent") == '0.0cm', 'height 0.0cm')
    check(q("document.querySelectorAll('#candles .candle:not(.off)').length") == 3, 'candles 3')
    check(q("document.querySelectorAll('#preview canvas').length") == 2, 'preview 2')
    # 첫 낙하: tries 1, tutDone, 고스트 사라짐, 높이 HUD = height().toFixed(1)
    q('__doltap.drop()')
    check(settle(page), 'aim 2')
    check(q("__doltap.store().days['20261001'].tries") == 1 and q('__doltap.store().tutDone') is True, 'tries/tutDone')
    check(q("document.getElementById('ghost').hidden"), 'ghost hidden')
    check(q("document.getElementById('height').textContent === `${__doltap.height().toFixed(1)}cm`"), 'height text')
    # 건너뛰기 버튼: 100ms 간격 2탭 → 실행, aria-disabled / 다시 2탭 → 변화 없음
    # 첫 사용자 제스처는 audio unlock(new AudioContext, 이 PC headless에서 ~400ms 동기 블록)을 부른다 →
    # 2탭 사이에 끼면 page.click 반환이 늦어 400ms 창을 넘는다. 무해한 키(Shift, 매핑 없음)로 먼저 unlock한다
    page.keyboard.press('Shift')
    page.wait_for_timeout(200)
    slot = view(page)['slot']
    page.click('#skip'); page.wait_for_timeout(100); page.click('#skip')
    v = view(page)
    check(v['skipUsed'] and v['slot'] == slot + 1, f'skip button {v["slot"]}')
    check(q("document.getElementById('skip').getAttribute('aria-disabled')") == 'true', 'aria-disabled')
    page.click('#skip', force=True); page.wait_for_timeout(100); page.click('#skip', force=True)
    check(view(page)['slot'] == slot + 1, 'skip once per run')
    # 완주: S8 카운트 '3'·입력 잠금 표시·drop 무시 → result, 저장
    r = q(RUN_TO_HOLD)
    check(r == {'c': '3', 'lock': True, 'st': 'hold'}, f'hold {r}')
    res = q("__doltap.until('result')")
    check(res['ok'] and q("document.getElementById('count').hidden"), f'result {res}')
    v = view(page)
    check(q("document.querySelectorAll('#candles .candle.off').length") == 3 - v['candles'], 'candles DOM')
    day = q("__doltap.store().days['20261001']")
    check(day['tries'] == 1 and abs(day['best']['H'] - v['H']) < 1e-9, f'saved {day}')
    finish('hud', errors)
