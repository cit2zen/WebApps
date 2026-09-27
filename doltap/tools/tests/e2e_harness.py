"""하네스 자체 검사: 서버 기동·경로/쿼리·__doltap 대기·console.error 수집·종료 후 포트 해제."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from harness import page_session, port_free  # noqa: E402

PORT = 8791
with page_session(port=PORT, path="/doltap/tools/tests/fixtures/harness_page.html", query="x=1") as (page, errors):
    assert page.url.endswith("/harness_page.html?x=1"), page.url
    assert page.evaluate("() => window.__doltap.fixture") is True
    assert page.text_content("#msg") == "harness"
    assert page.viewport_size == {"width": 390, "height": 844}
    assert errors == ["fixture-error"], errors
assert port_free(PORT), "세션 종료 뒤에도 포트가 열려 있다"
print("PASS harness")
