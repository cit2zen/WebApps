"""안내 페이지(GET /)·브라우저용 404 — 표시 전용, API 응답은 그대로"""
from sqlalchemy import create_engine

import db
from conftest import score_payload

BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"


def test_landing_is_polaroid_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.mimetype == "text/html"
    html = r.get_data(as_text=True)
    assert 'class="pol-appbar"' in html and 'href="https://cityzen.kr"' in html
    assert "Overclock Arena API" in html
    assert 'href="https://games.cityzen.kr/fps/"' in html
    for kit in ("design-tokens.css", "typography.css", "polaroid.css", "pol-ui.css", "fps-api.css"):
        assert f"/static/{kit}" in html
    assert "/api/scores/around" in html and "/healthz" in html
    assert "/api/stats" not in html          # 관리자 엔드포인트는 공개 목록에 없음
    assert "정상 운영" in html


def test_landing_csp_only_on_html(client):
    csp = client.get("/").headers.get("Content-Security-Policy", "")
    assert "default-src 'none'" in csp
    # 스크립트는 Cloudflare 비콘 한 출처만 — 인라인·eval·와일드카드 금지
    assert "script-src https://static.cloudflareinsights.com;" in csp
    assert "'unsafe-inline'" not in csp and "'unsafe-eval'" not in csp and "*" not in csp
    assert "https://fonts.googleapis.com" in csp and "frame-ancestors 'none'" in csp
    # JSON API 응답 헤더는 바뀌지 않는다
    for path in ("/healthz", "/api/scores?board=std-neon"):
        h = client.get(path).headers
        assert "Content-Security-Policy" not in h and "X-Frame-Options" not in h
        assert h["X-Content-Type-Options"] == "nosniff"


def test_landing_top10(client):
    for i, (name, score) in enumerate([("Alpha", 9000), ("Bravo", 12000), ("김철수", 15000)]):
        assert client.post("/api/scores", json=score_payload(name=name, score=score),
                           headers={"CF-Connecting-IP": f"9.9.9.{i}"}).status_code == 201
    html = client.get("/").get_data(as_text=True)
    assert html.index("김철수") < html.index("Bravo") < html.index("Alpha")
    assert "15,000" in html and 'class="pol-table fa-table"' in html


def test_landing_empty_board(client):
    html = client.get("/?board=std-foundry").get_data(as_text=True)
    assert "아직 이 보드에 기록이 없습니다" in html
    assert 'aria-current="page">Foundry' in html


def test_landing_unknown_board_falls_back(client):
    r = client.get("/?board=<script>")
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert "<script>" not in html
    assert 'aria-current="page">Neon' in html


def test_landing_escapes_names(make_app):
    app = make_app()
    row = {"board": "std-neon", "run_id": "ab" * 8, "name": "<b>x</b>", "name_key": "<b>x</b>", "score": 100,
           "wave": 1, "seconds": 30, "kills": 1, "revived": 0, "version": "1", "ip_hash": "h"}
    with app.extensions["fps_engine"].begin() as conn:
        db.insert_score(conn, row)
    html = app.test_client().get("/").get_data(as_text=True)
    assert "<b>x</b>" not in html and "&lt;b&gt;x&lt;/b&gt;" in html


def test_landing_db_down_graceful(make_app, tmp_path):
    app = make_app()
    app.extensions["fps_engine"] = create_engine("sqlite:///" + str(tmp_path / "missing" / "dir" / "x.db"))
    r = app.test_client().get("/")
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert "연결 끊김" in html and "데이터베이스에 연결할 수 없습니다" in html
    assert 'class="pol-table' not in html
    assert app.test_client().get("/healthz").status_code == 503


def test_landing_rate_limited_skips_db(make_app):
    r = make_app(RATE_READ=(0, 0.0)).test_client().get("/")
    assert r.status_code == 200
    assert "잠시 대기" in r.get_data(as_text=True)


def test_404_html_for_browsers(client):
    r = client.get("/nope", headers={"Accept": BROWSER_ACCEPT})
    assert r.status_code == 404 and r.mimetype == "text/html"
    html = r.get_data(as_text=True)
    assert "페이지를 찾을 수 없습니다" in html and 'class="pol-appbar"' in html
    assert "Content-Security-Policy" in r.headers
    assert "Accept" in r.headers.get_all("Vary")


def test_404_json_for_api_clients(client):
    for accept in (None, "*/*", "application/json", "application/json, text/html;q=0.5"):
        r = client.get("/nope", headers={"Accept": accept} if accept else {})
        assert r.status_code == 404 and r.mimetype == "application/json", accept
        assert r.get_json() == {"error": "not_found"}
        assert "Content-Security-Policy" not in r.headers


def test_kit_static_served(client):
    r = client.get("/static/pol-ui.css")
    assert r.status_code == 200 and r.mimetype == "text/css"
    assert r.get_data(as_text=True).startswith("/* SOURCE OF TRUTH")
    r.close()
