"""밸런싱 집계 — GET /api/stats?key=<FPS_ADMIN_KEY>[&days=30&version=x]. 키가 비어 있으면 엔드포인트 비활성(404)."""
import hmac
from collections import Counter, defaultdict
from statistics import mean, median

from flask import Blueprint, current_app, jsonify, request

import db

stats_bp = Blueprint("stats", __name__, url_prefix="/api")


def _pct(values, q):
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))] if s else 0


def aggregate(rows):
    by = defaultdict(list)
    waves, deaths, quality, versions, mods = Counter(), Counter(), Counter(), Counter(), defaultdict(lambda: [0, 0])
    rifle = rail = nades = minutes = revived = 0
    for r in rows:
        by[(r["arena"], r["mode"])].append(r)
        waves[r["wave"]] += 1
        deaths[r["death"]] += 1
        quality[str(r["quality"])] += 1
        versions[r["version"]] += 1
        rifle, rail, nades = rifle + r["rifle"], rail + r["rail"], nades + r["grenades"]
        minutes += r["seconds"] / 60.0
        revived += 1 if r["revives"] else 0
        for part in filter(None, r["mods"].split(";")):
            name, _, lv = part.partition("=")
            mods[name][0] += 1
            mods[name][1] += int(lv or 0)
    groups = []
    for (arena, mode), rs in sorted(by.items()):
        secs, wv = [x["seconds"] for x in rs], [x["wave"] for x in rs]
        groups.append({"arena": arena, "mode": mode, "runs": len(rs), "median_seconds": median(secs),
                       "median_wave": median(wv), "p90_wave": _pct(wv, 0.9),
                       "mean_kills": round(mean(x["kills"] for x in rs), 1),
                       "median_score": median(x["score"] for x in rs)})
    n = len(rows)
    per_min = (lambda t: round(t / minutes, 2) if minutes else 0.0)
    return {
        "runs": n,
        "by_arena_mode": groups,
        "wave_histogram": {str(k): waves[k] for k in sorted(waves)},
        "death_causes": dict(deaths),
        "weapons": {"rifle_shots": rifle, "rail_shots": rail, "grenades": nades,
                    "rifle_per_min": per_min(rifle), "rail_per_min": per_min(rail), "grenades_per_min": per_min(nades)},
        "mods": {k: {"runs": c[0], "levels": c[1], "pick_rate": round(c[0] / n, 3) if n else 0}
                 for k, c in sorted(mods.items(), key=lambda kv: -kv[1][0])},
        "quality": dict(quality),
        "versions": dict(versions),
        "revive_rate": round(revived / n, 3) if n else 0,
    }


@stats_bp.get("/stats")
def stats():
    admin = current_app.config.get("FPS_ADMIN_KEY", "")
    if not admin:
        return jsonify({"error": "disabled"}), 404
    given = request.args.get("key") or request.headers.get("X-Admin-Key", "")
    if not hmac.compare_digest(given.encode("utf-8"), admin.encode("utf-8")):
        return jsonify({"error": "forbidden"}), 403
    try:
        days = max(1, min(365, int(request.args.get("days", 30))))
    except ValueError:
        days = 30
    with current_app.extensions["fps_engine"].connect() as conn:
        rows = db.recent_runs(conn, days, request.args.get("version"))
    out = aggregate(rows)
    out["days"] = days
    resp = jsonify(out)
    resp.headers["Cache-Control"] = "no-store"
    return resp
