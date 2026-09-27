"""e2e_bot — 구현 7단계 완료 기준: __doltap.bot.run 1판 RunResult 형태, bot.month('20261001', 30) pass(§3 검산 8·9, 합격선 27/30)."""
import os
import re
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8805                                               # interfaces §A: e2e_bot 전용 포트
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    page.wait_for_function("() => window.__doltap.state() === 'lobby'", timeout=10000)   # Matter 로드 뒤
    before = page.evaluate('() => JSON.stringify(window.__doltap.store())')
    r = page.evaluate("() => window.__doltap.bot.run('20261001')")
    check(isinstance(r['H'], (int, float)) and r['H'] >= 0, f"bot.run H {r.get('H')}")
    check(re.fullmatch(r'[PSXE]{24}', r['grid'] or '') is not None, f"bot.run grid {r.get('grid')!r}")
    check(r['grid'].count('P') + r['grid'].count('S') == r['left'], 'grid P+S = left')
    check(r['grid'].count('X') == r['fell'], 'grid X = fell')
    check(r['skipped'] is False, '봇은 건너뛰기를 쓰지 않는다')
    m = page.evaluate("() => window.__doltap.bot.month('20261001', 30)")
    print(f"bot.month mean={m['mean']:.2f} inBand={m['inBand']}/30 floating={m['floating']} pass={m['pass']}")
    check(len(m['days']) == 30 and m['days'][0]['day'] == '20261001' and m['days'][-1]['day'] == '20261030', '30일 범위')
    check(m['floating'] == 0, f"공중 부양 {m['floating']}건")
    check(m['inBand'] >= 27, f"inBand {m['inBand']}/30")   # 합격선 27/30(2026-09-26 사용자 결정)
    check(m['pass'] is True, 'pass')
    check(page.evaluate('() => JSON.stringify(window.__doltap.store())') == before, '봇은 저장하지 않는다')
    check(page.evaluate('() => window.__doltap.state()') == 'lobby', '봇이 화면 판 상태를 바꾸지 않는다')
    check(errors == [], f'console error {errors}')

if fails:
    print('FAIL e2e_bot')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_bot')
