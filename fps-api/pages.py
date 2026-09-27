"""사람용 안내 페이지(Polaroid Editorial v2) — GET / 랜딩 + 브라우저용 404.
표시 전용: 기존 읽기 헬퍼(db.ping · db.ranked_rows · db.total_players)만 쓰고 API·검증·스키마는 건드리지 않는다.
템플릿은 Jinja 자동 이스케이프(플레이어 이름 = 사용자 입력)."""
from datetime import datetime, timezone

from flask import Blueprint, current_app, render_template, request

import db
import validate as v
from security import client_ip, ip_hash

pages_bp = Blueprint("pages", __name__)

GAME_URL = "https://games.cityzen.kr/fps/"
TOP_N = 10
ARENAS = (("neon", "Neon"), ("foundry", "Foundry"), ("rooftop", "Rooftop"))   # Unity ArenaTheme.All 순서

# HTML 응답 전용 — 앱 스크립트 없음, 외부 리소스는 Google Fonts(그레인 텍스처 = CSS data: 이미지)와
# Cloudflare가 엣지에서 자동 삽입하는 Web Analytics 비콘 한 출처만(다른 cityzen 사이트와 동일, 차단 시 콘솔 오류)
CSP = ("default-src 'none'; script-src https://static.cloudflareinsights.com; connect-src https://cloudflareinsights.com; "
       "style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")

ENDPOINTS = (
    ("POST", "/api/scores", "서명된 점수 제출 — 순위·개인 최고 기록을 돌려줍니다"),
    ("GET", "/api/scores?board=&limit=", "보드 TOP N — 이름별 최고 기록 1줄, 동점은 같은 순위"),
    ("GET", "/api/scores/around?board=&score=", "이 점수가 들어갈 순위와 위아래 2줄"),
    ("POST", "/api/runs", "익명 판 텔레메트리 — 개인정보 없이 밸런싱용 결과만"),
    ("GET", "/healthz", "서비스·데이터베이스 연결 상태"),
)


def wants_html() -> bool:
    """Accept에서 text/html이 application/json보다 우선일 때만(브라우저). 헤더 없음·*/*·JSON은 False"""
    acc = request.accept_mimetypes
    return acc["text/html"] > acc["application/json"]


def html_security_headers(resp):
    if resp.mimetype == "text/html":
        resp.headers.setdefault("Content-Security-Policy", CSP)
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return resp


def not_found_page():
    resp = current_app.make_response((render_template("404.html", game_url=GAME_URL), 404))
    resp.headers.add("Vary", "Accept")
    return resp


def _boards():
    today = "daily-" + datetime.now(timezone.utc).strftime("%Y%m%d")   # 게임과 같은 UTC 날짜 키
    return [{"key": f"std-{a}", "board": f"std-{a}", "label": label} for a, label in ARENAS] + \
           [{"key": "daily", "board": today, "label": "오늘"}]


def _row(r):
    s = r["seconds"]
    return {"rank": r["rank"], "name": r["name"], "score": f"{r['score']:,}", "wave": r["wave"],
            "time": f"{s // 60}:{s % 60:02d}", "kills": f"{r['kills']:,}", "podium": r["rank"] <= 3}


def _leaderboard(board):
    """(상태, 행, 총원) — 상태 ok · busy(레이트 리밋) · down(DB 연결 실패) · error(조회 실패)"""
    bucket = current_app.extensions["fps_buckets"]["read"]
    key = ip_hash(current_app.config["FPS_IP_SALT"], client_ip(request, current_app.config["FPS_IP_HEADER"]))
    if not bucket.allow(key):
        return "busy", [], 0
    engine = current_app.extensions["fps_engine"]
    if not db.ping(engine):
        return "down", [], 0
    try:
        with engine.connect() as conn:
            rows = db.ranked_rows(conn, board, 0, TOP_N)
            total = db.total_players(conn, board)
    except Exception as e:  # noqa: BLE001 — 안내 페이지는 원인 대신 상태만
        current_app.logger.warning("landing leaderboard unavailable: %s", type(e).__name__)
        return "error", [], 0
    return "ok", [_row(r) for r in rows], total


@pages_bp.get("/")
def landing():
    boards = _boards()
    want = request.args.get("board", "std-neon")
    current = next((b for b in boards if b["key"] == want), boards[0])
    board = v.check_board(current["board"]) or "std-neon"
    state, rows, total = _leaderboard(board)
    return render_template("index.html", state=state, rows=rows, total=total, boards=boards, current=current,
                           endpoints=ENDPOINTS, game_url=GAME_URL, best=rows[0]["score"] if rows else None)
