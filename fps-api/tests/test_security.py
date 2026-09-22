import pytest

from conftest import score_payload, run_payload
from security import TokenBucket, sign


# ── 서명 ──
def test_valid_signature_accepted(client):
    r = client.post("/api/scores", json=score_payload())
    assert r.status_code == 201, r.get_json()


def test_missing_signature(client):
    p = score_payload()
    del p["sig"]
    assert client.post("/api/scores", json=p).status_code == 401


def test_wrong_key(client):
    assert client.post("/api/scores", json=score_payload(key="other-key")).status_code == 401


def test_tampered_score(client):
    p = score_payload()
    p["score"] += 1000
    r = client.post("/api/scores", json=p)
    assert r.status_code == 401
    assert r.get_json()["error"] == "bad_signature"


def test_signature_over_raw_hangul_name(client):
    r = client.post("/api/scores", json=score_payload(name="  김철수 "))
    assert r.status_code == 201
    assert r.get_json()["name"] == "김철수"


def test_known_vector():
    # 클라이언트(C# Hmac256) 교차 검증용 고정 벡터 — Online/Hmac256.cs 주석과 같은 값
    parts = ("v1", "score", "std-neon", "김철수", 12000, 6, 180, 60, 0, "1.0.0", "00000000000000ff")
    assert sign("fps-dev-key-change-me", parts) == "18c9635e6b86d874d08217162247c2224164b18d5eb8a2da4a700fbf8b423169"


# ── 그럴듯함 ──
@pytest.mark.parametrize("kw,reason", [
    ({"score": 5_000_000}, "score"),
    ({"wave": 20, "seconds": 20}, "too_fast"),
    ({"kills": 1000, "wave": 6}, "kills"),
    ({"kills": 200, "seconds": 30, "wave": 5}, "kill_rate"),
    ({"seconds": 14000, "kills": 5, "wave": 2}, "too_long"),
])
def test_implausible(client, kw, reason):
    r = client.post("/api/scores", json=score_payload(**kw))
    assert r.status_code == 422
    assert r.get_json()["reason"] == reason


def test_plausible_strong_run(client):
    # 강한 판: 웨이브 14, 300킬, 9분, 20만 점
    r = client.post("/api/scores", json=score_payload(wave=14, kills=300, seconds=540, score=200_000))
    assert r.status_code == 201


def test_revive_allows_extra_time(client):
    base = dict(wave=1, kills=0, score=0, seconds=650)
    assert client.post("/api/scores", json=score_payload(**base)).status_code == 422       # 30 + 12 + 600 = 642 초과
    assert client.post("/api/scores", json=score_payload(revived=1, **base)).status_code == 201


# ── 레이트 리밋 ──
def test_rate_limit_per_ip(make_app):
    c = make_app(RATE_SCORES=(2, 0.0)).test_client()
    h = {"CF-Connecting-IP": "1.2.3.4"}
    assert c.post("/api/scores", json=score_payload(), headers=h).status_code == 201
    assert c.post("/api/scores", json=score_payload(name="Other"), headers=h).status_code == 201
    r = c.post("/api/scores", json=score_payload(name="Third"), headers=h)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1
    assert c.post("/api/scores", json=score_payload(name="Fourth"), headers={"CF-Connecting-IP": "5.6.7.8"}).status_code == 201


def test_rate_limit_reads(make_app):
    c = make_app(RATE_READ=(3, 0.0)).test_client()
    codes = [c.get("/api/scores?board=std-neon").status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_token_bucket_refill():
    t = [0.0]
    b = TokenBucket(2, 1.0, clock=lambda: t[0])
    assert b.allow("k") and b.allow("k") and not b.allow("k")
    t[0] = 1.0
    assert b.allow("k") and not b.allow("k")


def test_ip_not_stored_raw(make_app):
    app = make_app()
    c = app.test_client()
    c.post("/api/scores", json=score_payload(), headers={"CF-Connecting-IP": "9.9.9.9"})
    with app.extensions["fps_engine"].connect() as conn:
        stored = conn.exec_driver_sql("SELECT ip_hash FROM fps_scores").scalar()
    assert stored and "9.9.9.9" not in stored and len(stored) == 24


# ── CORS ──
@pytest.mark.parametrize("origin", [
    "https://games.cityzen.kr", "http://127.0.0.1:8777", "https://overclock-arena.game-files.crazygames.com",
    "https://www.crazygames.com", "https://www.crazygames.co.kr", "https://www.crazygames.com.br",
    "https://games.crazygames.com", "https://www.1001juegos.com", "capacitor://app.crazygames.com",
])
def test_cors_allowed(client, origin):
    r = client.get("/api/scores?board=std-neon", headers={"Origin": origin})
    assert r.headers.get("Access-Control-Allow-Origin") == origin
    assert "Origin" in r.headers.get("Vary", "")


@pytest.mark.parametrize("origin", [
    "https://evil.com", "https://crazygames.evil.com", "https://www.crazygames.com.evil.com", "http://games.cityzen.kr",
    "https://games.cityzen.kr.evil.com", "http://127.0.0.1:9999", "null",
])
def test_cors_blocked(client, origin):
    r = client.get("/api/scores?board=std-neon", headers={"Origin": origin})
    assert "Access-Control-Allow-Origin" not in r.headers


def test_cors_preflight(client):
    r = client.options("/api/scores", headers={"Origin": "https://games.cityzen.kr", "Access-Control-Request-Method": "POST",
                                               "Access-Control-Request-Headers": "content-type"})
    assert r.status_code in (200, 204)
    assert r.headers["Access-Control-Allow-Origin"] == "https://games.cityzen.kr"
    assert "POST" in r.headers["Access-Control-Allow-Methods"]
    assert "Content-Type" in r.headers["Access-Control-Allow-Headers"]


def test_extra_origin_env(make_app):
    c = make_app(FPS_EXTRA_ORIGINS=["https://staging.cityzen.kr"]).test_client()
    r = c.get("/healthz", headers={"Origin": "https://staging.cityzen.kr"})
    assert r.headers.get("Access-Control-Allow-Origin") == "https://staging.cityzen.kr"


def test_runs_signature(client):
    p = run_payload()
    p["wave"] = 7
    assert client.post("/api/runs", json=p).status_code == 401
