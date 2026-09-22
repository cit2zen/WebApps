"""API — 점수(제출·TOP N·내 주변 순위) · 판 텔레메트리. 응답은 모두 JSON, 오류는 {"error": 코드}."""
from flask import Blueprint, current_app, g, jsonify, request

import db
import validate as v
from security import client_ip, ip_hash, run_parts, score_parts, verify

api_bp = Blueprint("api", __name__, url_prefix="/api")


def err(code, status, **extra):
    return jsonify({"error": code, **extra}), status


def limited(bucket_name):
    """레이트 리밋 — 초과면 429 응답, 아니면 None"""
    bucket = current_app.extensions["fps_buckets"][bucket_name]
    key = g.ip_hash
    if bucket.allow(key):
        return None
    resp, status = err("rate_limited", 429)
    resp.headers["Retry-After"] = str(bucket.retry_after(key))
    return resp, status


@api_bp.before_request
def _ip():
    g.ip_hash = ip_hash(current_app.config["FPS_IP_SALT"], client_ip(request, current_app.config["FPS_IP_HEADER"]))


def _engine():
    return current_app.extensions["fps_engine"]


def _common(body):
    """점수·텔레메트리 공통 필드. (값 dict, 오류코드)"""
    p = {
        "board": v.check_board(body.get("board")),
        "run": v.match(v.RUN_RE, body.get("run")),
        "version": v.match(v.VERSION_RE, body.get("version")),
        "wave": v.as_int(body.get("wave"), 1, v.MAX_WAVE),
        "seconds": v.as_int(body.get("seconds"), 0, v.MAX_SECONDS),
        "kills": v.as_int(body.get("kills"), 0, 100000),
        "score": v.as_int(body.get("score"), 0, 2_000_000_000),
    }
    bad = next((k for k, val in p.items() if val is None), None)
    return p, ("invalid_" + bad if bad else None)


# ── 점수 ─────────────────────────────────────────────────────────────
@api_bp.post("/scores")
def submit_score():
    hit = limited("scores")
    if hit:
        return hit
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return err("bad_request", 400)
    p, bad = _common(body)
    if bad:
        return err(bad, 400)
    p["revived"] = v.as_int(body.get("revived", 0), 0, 1)
    if p["revived"] is None:
        return err("invalid_revived", 400)
    raw_name = body.get("name")
    name, name_err = v.clean_name(raw_name)
    if name_err:
        return err(name_err, 400)
    # 서명은 클라이언트가 보낸 원래 문자열 기준
    if not verify(current_app.config["FPS_API_KEY"], score_parts({**p, "name": raw_name}), body.get("sig")):
        return err("bad_signature", 401)
    why = v.implausible(p["score"], p["wave"], p["seconds"], p["kills"], p["revived"], current_app.config["FPS_SCORE_SLACK"])
    if why:
        return err("implausible", 422, reason=why)

    row = {"board": p["board"], "run_id": p["run"], "name": name, "name_key": v.name_key(name), "score": p["score"],
           "wave": p["wave"], "seconds": p["seconds"], "kills": p["kills"], "revived": p["revived"],
           "version": p["version"], "ip_hash": g.ip_hash}
    with _engine().begin() as conn:
        prev = db.find_run_score(conn, p["board"], p["run"])
        if prev:
            # 같은 판 재제출은 "부활 후 이어서 더 나아간 결과"만 교체 허용(단조 증가 + 같은 이름)
            grew = (row["name_key"] == prev["name_key"] and row["score"] > prev["score"] and row["wave"] >= prev["wave"]
                    and row["seconds"] >= prev["seconds"] and row["kills"] >= prev["kills"])
            if not grew:
                return err("duplicate", 409)
            db.update_score(conn, prev["id"], row)
        else:
            if db.recent_same(conn, row) or not db.insert_score(conn, row):
                return err("duplicate", 409)
        rank = db.rank_of(conn, p["board"], p["score"], row["name_key"])
        best = db.best_of(conn, p["board"], row["name_key"])
        best_rank = db.rank_of(conn, p["board"], best, row["name_key"])
        total = db.total_players(conn, p["board"])
    return jsonify({"ok": True, "board": p["board"], "rank": rank, "total": total, "best": best,
                    "best_rank": best_rank, "name": name}), 201


def _board_arg():
    return v.check_board(request.args.get("board", ""))


@api_bp.get("/scores")
def top_scores():
    hit = limited("read")
    if hit:
        return hit
    board = _board_arg()
    if not board:
        return err("invalid_board", 400)
    try:
        limit = max(1, min(50, int(request.args.get("limit", 20))))
    except ValueError:
        return err("invalid_limit", 400)
    with _engine().connect() as conn:
        rows = db.ranked_rows(conn, board, 0, limit)
        total = db.total_players(conn, board)
    return jsonify({"board": board, "total": total, "scores": rows})


@api_bp.get("/scores/around")
def around():
    """이 점수가 들어갈 순위 + 위아래 2줄씩(이름을 주면 그 이름의 기존 기록은 제외하고 셈)"""
    hit = limited("read")
    if hit:
        return hit
    board = _board_arg()
    if not board:
        return err("invalid_board", 400)
    try:
        score = int(request.args.get("score", ""))
    except ValueError:
        return err("invalid_score", 400)
    name = request.args.get("name")
    key = v.name_key(name) if isinstance(name, str) and name.strip() else None
    with _engine().connect() as conn:
        rank = db.rank_of(conn, board, score, key)
        rows = db.ranked_rows(conn, board, max(0, rank - 3), 5)
        total = db.total_players(conn, board)
    return jsonify({"board": board, "rank": rank, "total": total, "scores": rows})


# ── 텔레메트리(개인정보 없음: 판 결과·무기 사용·모듈·품질) ─────────────────
@api_bp.post("/runs")
def submit_run():
    hit = limited("runs")
    if hit:
        return hit
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return err("bad_request", 400)
    p, bad = _common(body)
    if bad:
        return err(bad, 400)
    if not verify(current_app.config["FPS_API_KEY"], run_parts(p), body.get("sig")):
        return err("bad_signature", 401)
    mods = body.get("mods", "")
    extra = {
        "arena": v.match(v.ARENA_RE, body.get("arena")),
        "mode": body.get("mode") if body.get("mode") in ("std", "daily") else None,
        "death": v.match(v.DEATH_RE, body.get("death", "unknown")),
        "mods": mods if mods == "" or v.match(v.MODS_RE, mods) else None,
        "rifle": v.as_int(body.get("rifle", 0), 0, 1_000_000),
        "rail": v.as_int(body.get("rail", 0), 0, 1_000_000),
        "grenades": v.as_int(body.get("grenades", 0), 0, 1_000_000),
        "quality": v.as_int(body.get("quality", 2), 0, 2),
        "revives": v.as_int(body.get("revives", 0), 0, 10),
    }
    bad = next((k for k, val in extra.items() if val is None), None)
    if bad:
        return err("invalid_" + bad, 400)
    if v.implausible(p["score"], p["wave"], p["seconds"], p["kills"], extra["revives"], current_app.config["FPS_SCORE_SLACK"]):
        return err("implausible", 422)
    row = {"run_id": p["run"], "board": p["board"], "wave": p["wave"], "seconds": p["seconds"], "kills": p["kills"],
           "score": p["score"], "version": p["version"], **extra}
    with _engine().begin() as conn:
        created = db.upsert_run(conn, row)
    return jsonify({"ok": True, "updated": not created}), 201 if created else 200
