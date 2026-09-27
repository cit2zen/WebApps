"""e2e_cdn — §8 25단계(콘솔 집계 뒤 별도 실행): Matter CDN 차단 → 5초 뒤 S1 '돌을 불러오지 못했어요' + '다시 시도'."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8810                                               # interfaces §A: e2e_cdn 전용 포트
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


with page_session(port=PORT, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    page.route('**/matter.min.js', lambda r: r.abort())
    page.reload()
    page.wait_for_timeout(5500)
    check(page.evaluate('() => window.__doltap ? window.__doltap.state() : null') == 'error', 'state() === error')
    check(page.is_visible('#error') and '돌을 불러오지 못했어요' in (page.text_content('#error') or ''), 'S1 제목')
    check(page.locator('#error button', has_text='다시 시도').is_visible(), 'S1 다시 시도 버튼')
    page.unroute('**/matter.min.js')
    other = [e for e in errors if 'Failed to load resource' not in e]   # 차단으로 생긴 리소스 오류는 집계하지 않는다(§8 25)
    check(other == [], f'차단 외 console error {other}')

if fails:
    print('FAIL e2e_cdn')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('PASS e2e_cdn')
