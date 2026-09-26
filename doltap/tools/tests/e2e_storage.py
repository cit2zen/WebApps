"""구현 2단계 완료 기준 1·2(브라우저): setToday 전후 #N, contentFallback 폴백 2개(네트워크 0), store·wipe·tut 저장 왕복."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import page_session  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

with page_session(port=8792) as (page, errors):
    # setToday 전후 #N
    assert page.evaluate("() => __doltap.setToday('20261005')") == "20261005"
    assert page.evaluate("() => [__doltap.daily().n, __doltap.daily().day]") == [5, "20261005"]
    assert page.evaluate("() => __doltap.setToday('20260926')") == "20260926"
    assert page.evaluate("() => __doltap.daily().n") == -4
    real = page.evaluate("() => __doltap.setToday(null)")
    assert page.evaluate("() => __doltap.daily().day") == real

    # contentFallback: 폴백 문구 2개, data/*.json 요청 0
    reqs = []
    page.on("request", lambda r: reqs.append(r.url) if "/data/" in r.url else None)
    fb = page.evaluate("() => __doltap.contentFallback()")
    assert fb == {"wish": "오늘도 무사히 내려가기를", "trail": "이름 없는 산길", "fallback": True}, fb
    assert reqs == [], reqs

    # store·wipe·tut: doltap:v1 왕복과 새로고침 뒤 유지
    assert page.evaluate("() => __doltap.wipe()") is True
    assert page.evaluate("() => localStorage.getItem('doltap:v1')") is None
    s = page.evaluate("() => __doltap.store()")
    assert s == {"v": 1, "days": {}, "streak": 0, "maxStreak": 0, "lastDay": None, "bestEver": 0,
                 "sound": True, "vibe": True, "hand": "R", "tutDone": False}, s
    assert page.evaluate("() => __doltap.tut(true)") is True
    assert '"tutDone":true' in page.evaluate("() => localStorage.getItem('doltap:v1')")
    page.reload()
    page.wait_for_function("() => !!window.__doltap", timeout=10000)
    assert page.evaluate("() => __doltap.store().tutDone") is True
    assert page.evaluate("() => { const s = __doltap.store(); s.tutDone = false; return __doltap.store().tutDone; }") is True
    assert page.evaluate("() => __doltap.tut(false)") is False
    assert page.evaluate("() => __doltap.wipe()") is True
    assert page.evaluate("() => localStorage.getItem('doltap:v1')") is None
    assert errors == [], errors
print("PASS storage")
