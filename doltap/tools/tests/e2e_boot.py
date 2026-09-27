import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session
sys.stdout.reconfigure(encoding='utf-8')

with page_session(port=8796, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
    # 정상 경로: 부트 → lobby, S1 숨김
    page.wait_for_function("() => window.__doltap.state() === 'lobby'", timeout=8000)
    assert page.is_hidden('#error') and page.is_hidden('#boot')
    ok_errors = list(errors)

    # CDN 실패: Matter 요청을 막고 새로고침 → 5000ms 폴링 뒤 S1
    page.route('**/matter.min.js', lambda r: r.abort())
    t0 = time.time()
    page.reload()
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'error'", timeout=9000)
    waited = time.time() - t0
    assert waited >= 4.5, waited
    assert page.is_visible('#error') and page.is_hidden('#boot') and page.is_hidden('#game')
    assert page.inner_text('#error h1') == '돌을 불러오지 못했어요'
    assert page.inner_text('#error p') == '인터넷 연결을 확인하고 다시 시도해 주세요'
    btn = page.locator('#error button')
    assert btn.inner_text() == '다시 시도'
    assert btn.bounding_box()['height'] >= 48, btn.bounding_box()
    page.unroute('**/matter.min.js')

    # 다시 시도 = location.reload → 정상 부트
    btn.click()
    page.wait_for_function("() => window.__doltap && window.__doltap.state() === 'lobby'", timeout=8000)

    real = [e for e in errors if 'Failed to load resource' not in e and 'net::ERR' not in e]
    assert ok_errors == [] and real == [], (ok_errors, real)
print('PASS boot')
