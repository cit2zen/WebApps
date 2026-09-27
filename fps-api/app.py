"""fps-api — Overclock Arena(games.cityzen.kr/fps · CrazyGames) 글로벌 랭킹 + 익명 판 텔레메트리.
진입점 wsgi:app. API는 JSON 전용 — 사람용 안내 페이지(GET /)와 브라우저용 404만 HTML(pages.py, Polaroid v2)."""
import re

from flask import Flask, jsonify, request

import config
import db
import pages
from routes import api_bp
from security import TokenBucket
from stats import stats_bp


def _origin_allowed(app, origin: str) -> bool:
    if not origin:
        return False
    if origin in config.ORIGINS or origin in app.config["FPS_EXTRA_ORIGINS"]:
        return True
    return any(re.match(p, origin) for p in config.ORIGIN_PATTERNS)


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(config.from_env())
    if test_config:
        app.config.update(test_config)
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024   # 요청 본문 8KB 상한
    app.json.sort_keys = False

    app.extensions["fps_engine"] = db.make_engine(app.config["DATABASE_URL"])
    app.extensions["fps_buckets"] = {
        "scores": TokenBucket(*app.config["RATE_SCORES"]),
        "runs": TokenBucket(*app.config["RATE_RUNS"]),
        "read": TokenBucket(*app.config["RATE_READ"]),
    }
    app.register_blueprint(api_bp)
    app.register_blueprint(stats_bp)
    app.register_blueprint(pages.pages_bp)

    @app.get("/healthz")
    def healthz():
        if db.ping(app.extensions["fps_engine"]):   # 헬스체크는 원인 대신 상태만
            return jsonify({"ok": True, "db": True})
        return jsonify({"ok": False, "db": False}), 503

    # CORS: 허용 오리진만 그대로 반사(자격 증명 없음). OPTIONS 프리플라이트는 Flask 자동 응답 + 아래 헤더
    @app.after_request
    def cors(resp):
        origin = request.headers.get("Origin", "")
        if _origin_allowed(app, origin):
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            resp.headers["Access-Control-Max-Age"] = "600"
        resp.headers.add("Vary", "Origin")
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    # HTML 응답(안내 페이지·브라우저 404)에만 CSP 등 — JSON API 응답은 그대로
    app.after_request(pages.html_security_headers)

    @app.errorhandler(404)
    def not_found(_e):
        if pages.wants_html():   # 브라우저(Accept가 text/html 우선)만 Polaroid 404, API 클라이언트는 JSON 그대로
            return pages.not_found_page()
        resp = jsonify({"error": "not_found"})
        resp.headers.add("Vary", "Accept")
        return resp, 404

    @app.errorhandler(405)
    def not_allowed(_e):
        return jsonify({"error": "method_not_allowed"}), 405

    @app.errorhandler(413)
    def too_large(_e):
        return jsonify({"error": "too_large"}), 413

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "server_error"}), 500

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
