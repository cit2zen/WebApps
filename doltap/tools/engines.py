"""engines.py — 3엔진 결정성(§3 검산 10): 헤드리스 WebKit·Firefox에서 hashRange digest를 ref.json과 대조한다.

사용: python tools/engines.py [--port 8811]
  - 포트(기본 8811, interfaces §A 전용 포트)에 서버가 없으면 develop_web/WebApps를 루트로 127.0.0.1에만 묶은 임시 http.server를 띄웠다가 끝에 끈다.
  - ref.json은 먼저 `python tools/ref_stones.py --from 20261001 --days 365 --out tools/ref.json`으로 만든다.
출력: 두 엔진 모두 일치하면 'OK webkit firefox' + exit 0, 아니면 'FAIL <engine> …' 줄들 + exit 1.
"""
import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPPS = os.path.dirname(os.path.dirname(HERE))
REF = os.path.join(HERE, 'ref.json')
FROM, DAYS, EPS = '20261001', 365, 1e-9


def digest(rows):
    return hashlib.sha256('\n'.join(r['hash'] for r in rows).encode('utf-8')).hexdigest()


def listening(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0


def ensure_server(port):
    if listening(port):
        return None
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '-d', WEBAPPS],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if listening(port):
            return p
        time.sleep(0.1)
    p.terminate()
    raise SystemExit(f'FAIL server: 포트 {port}가 열리지 않음')


def diff_days(rows, ref):
    bad = []
    for r, d in zip(rows, ref):
        num = any(abs(a - b) >= EPS for k in ('r0', 'r', 's') for a, b in zip(r[k], d[k]))
        if r['day'] != d['day'] or r['hash'] != d['hash'] or num:
            bad.append(d['day'])
    return bad


def run_engine(pw, name, port):
    browser = getattr(pw, name).launch(headless=True)
    try:
        page = browser.new_page()
        page.goto(f'http://127.0.0.1:{port}/doltap/')
        page.wait_for_function('() => !!window.__doltap', timeout=15000)
        return page.evaluate(f"() => window.__doltap.hashRange('{FROM}', {DAYS})")
    finally:
        browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8811)
    port = ap.parse_args().port
    with open(REF, encoding='utf-8') as f:
        ref = json.load(f)
    want, ok = digest(ref), []
    srv = ensure_server(port)
    try:
        with sync_playwright() as pw:
            for name in ('webkit', 'firefox'):
                rows = run_engine(pw, name, port)
                bad = diff_days(rows, ref)
                if len(rows) == len(ref) == DAYS and digest(rows) == want and not bad:
                    ok.append(name)
                else:
                    print(f'FAIL {name}: rows={len(rows)} digest={digest(rows)[:12]} want={want[:12]} 불일치 {bad[:5]}')
    finally:
        if srv:
            srv.terminate()
    if ok == ['webkit', 'firefox']:
        print('OK webkit firefox')
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
