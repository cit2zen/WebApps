"""e2e_params — §8 22·23·24단계: ?c= 3종·XSS, content 폴백, 365일 해시 digest(ref.json), convexCheck, bot.month, console error 0·warn ≤ 1."""
import hashlib
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8809                                               # interfaces §A: e2e_params 전용 포트
BASE = f'http://127.0.0.1:{PORT}/doltap/'
REF = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ref.json')
DIGEST = r"""async () => { const rows = await window.__doltap.hashRange('20261001', 365);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rows.map(r => r.hash).join('\n')));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }"""
CASES = [('?c=1485', '친구 기록 148.5cm에 도전'), ('?c=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', None), ('?c=999999', None)]
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def text(page, sel):
    return page.evaluate('s => { const e = document.querySelector(s); return e ? e.textContent : null; }', sel)


with open(REF, encoding='utf-8') as f:
    ref = json.load(f)
py_digest = hashlib.sha256('\n'.join(d['hash'] for d in ref).encode('utf-8')).hexdigest()

with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    alerts, warns = [], []
    page.on('dialog', lambda d: (alerts.append(d.message), d.dismiss()))
    page.on('console', lambda m: warns.append(m.text) if m.type == 'warning' else None)
    # 22 — URL 파라미터: 정상만 배지, XSS·6자리는 배지 없음, img 0, alert 없음
    for q, want in CASES:
        page.goto(BASE + q)
        page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=10000)
        page.evaluate("() => window.__doltap.setToday('20261001')")
        check(text(page, '#lobby-sub .pol-chip') == want, f"22 {q} 배지 {text(page, '#lobby-sub .pol-chip')!r}")
        check(page.evaluate("() => document.querySelectorAll('#lobby img').length") == 0, f'22 {q} img 0')
    check(alerts == [], f'22 alert {alerts}')
    check(warns == [], f'22 정상 경로 warn 0 {warns}')
    # 23 — content 폴백 · 결정성 · 볼록성 · 봇
    fb = page.evaluate('() => window.__doltap.contentFallback()')
    check(fb == {'wish': '오늘도 무사히 내려가기를', 'trail': '이름 없는 산길', 'fallback': True}, f'23 폴백 {fb}')
    js_digest = page.evaluate(DIGEST)
    check(len(ref) == 365 and js_digest == py_digest, f'23 digest js={js_digest[:12]} py={py_digest[:12]}')
    cc = page.evaluate("() => window.__doltap.convexCheck('20261001', 365)")
    check(cc == {'stones': 8760, 'reHulled': 0}, f'23 convexCheck {cc}')
    bm = page.evaluate("() => window.__doltap.bot.month('20261001', 30)")
    print(f"bot.month mean={bm['mean']:.2f} inBand={bm['inBand']} floating={bm['floating']} (§9 Q2 기록값)")
    check(bm['pass'] is True and bm['inBand'] >= 27 and bm['floating'] == 0, f"23 bot {bm['inBand']} {bm['floating']}")
    # 24 — 세션 전체 console error 0, warn은 content 폴백 1회만
    check(len(warns) <= 1, f'24 warn {warns}')
    check(errors == [], f'24 console error {errors}')

if fails:
    print('FAIL e2e_params')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_params')
