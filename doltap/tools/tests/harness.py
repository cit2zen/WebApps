"""돌탑 e2e 공용 하네스: WebApps 루트 정적 서버 + Playwright Chromium 페이지 1개.

사용:
    from harness import page_session   # 스크립트는 sys.path.insert(0, dirname(__file__))
    with page_session(port=8790, viewport=(390, 844), path='/doltap/', query='') as (page, errors):
        ...
- 서버: `python -m http.server <port> --bind 127.0.0.1`을 WebApps 루트에서 띄우고 종료 시 죽인다.
- page는 http://127.0.0.1:<port><path><query>로 이동한 뒤 window.__doltap이 생길 때까지(10s) 기다린다.
- errors는 console 'error' 텍스트 + pageerror 텍스트의 실시간 목록이다.
"""
import contextlib
import http.client
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]  # tools/tests → tools → doltap → WebApps 루트


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def _ready(port):
    try:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1)  # 프록시를 거치지 않는다
        conn.request("HEAD", "/")
        ok = conn.getresponse().status == 200
        conn.close()
        return ok
    except OSError:
        return False


@contextlib.contextmanager
def serve(port):
    assert port_free(port), f"포트 {port}가 이미 사용 중이다(좀비 서버 확인)"
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.time() + 10
        while not _ready(port):
            assert proc.poll() is None, "http.server가 바로 종료됐다"
            assert time.time() < deadline, "http.server가 10s 안에 응답하지 않았다"
            time.sleep(0.1)
        yield proc
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(5)


@contextlib.contextmanager
def page_session(port=8790, viewport=(390, 844), path="/doltap/", query="", has_touch=False):
    if query and not query.startswith("?"):
        query = "?" + query
    with serve(port), sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": viewport[0], "height": viewport[1]}, has_touch=has_touch)
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}{path}{query}")
            page.wait_for_function("() => !!window.__doltap", timeout=10000)
            yield page, errors
        finally:
            browser.close()
