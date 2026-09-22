from conftest import run_payload, score_payload


def post(client, **kw):
    return client.post("/api/scores", json=score_payload(**kw))


def test_health(client):
    r = client.get("/healthz")
    assert r.status_code == 200 and r.get_json() == {"ok": True, "db": True}


def test_top_n_ordering_and_dedupe(client):
    post(client, name="Alpha", score=5000)
    post(client, name="Bravo", score=9000)
    post(client, name="Charlie", score=7000)
    post(client, name="alpha", score=8000)         # 같은 이름(대소문자 무시) → 최고 기록 1줄만
    post(client, name="Delta", score=7000)         # 동점
    post(client, name="Echo", score=1000, board="std-other")
    r = client.get("/api/scores?board=std-neon&limit=20")
    body = r.get_json()
    assert r.status_code == 200
    assert [(s["name"], s["score"], s["rank"]) for s in body["scores"]] == [
        ("Bravo", 9000, 1), ("alpha", 8000, 2), ("Charlie", 7000, 3), ("Delta", 7000, 3)]
    assert body["total"] == 4
    assert set(body["scores"][0]) == {"rank", "name", "score", "wave", "seconds", "kills"}


def test_top_limit(client):
    for i in range(6):
        post(client, name=f"P{i}", score=1000 + i)
    body = client.get("/api/scores?board=std-neon&limit=3").get_json()
    assert [s["score"] for s in body["scores"]] == [1005, 1004, 1003]
    assert client.get("/api/scores?board=std-neon&limit=abc").status_code == 400
    assert client.get("/api/scores?board=bad").status_code == 400


def test_submit_returns_rank(client):
    post(client, name="Bravo", score=9000)
    post(client, name="Charlie", score=7000)
    body = post(client, name="Mine", score=8000).get_json()
    assert body["rank"] == 2 and body["total"] == 3 and body["best"] == 8000 and body["best_rank"] == 2
    # 더 낮은 판: 이번 판 순위 3, 최고 기록은 그대로 2위
    body = post(client, name="Mine", score=6000).get_json()
    assert body["rank"] == 3 and body["best"] == 8000 and body["best_rank"] == 2


def test_around(client):
    for i, s in enumerate([9000, 8000, 7000, 6000, 5000, 4000]):
        post(client, name=f"N{i}", score=s)
    body = client.get("/api/scores/around?board=std-neon&score=6500").get_json()
    assert body["rank"] == 4 and body["total"] == 6
    assert [s["score"] for s in body["scores"]] == [8000, 7000, 6000, 5000, 4000]
    # 이름을 주면 자기 기존 기록은 세지 않는다
    body = client.get("/api/scores/around?board=std-neon&score=8500&name=n0").get_json()
    assert body["rank"] == 1


def test_duplicate_run_rejected(client):
    p = score_payload(name="Dup", score=4000)
    assert client.post("/api/scores", json=p).status_code == 201
    r = client.post("/api/scores", json=p)
    assert r.status_code == 409 and r.get_json()["error"] == "duplicate"


def test_duplicate_content_rejected(client):
    assert post(client, name="Same", score=4321, wave=5, seconds=150, kills=40).status_code == 201
    assert post(client, name="Same", score=4321, wave=5, seconds=150, kills=40).status_code == 409   # 새 run id라도 같은 결과


def test_revive_continuation_updates_same_run(client):
    run = "00000000000000aa"
    assert client.post("/api/scores", json=score_payload(name="Rev", run=run, score=5000, wave=5, seconds=150, kills=40)).status_code == 201
    r = client.post("/api/scores", json=score_payload(name="Rev", run=run, score=9000, wave=7, seconds=260, kills=70, revived=1))
    assert r.status_code == 201 and r.get_json()["best"] == 9000
    body = client.get("/api/scores?board=std-neon").get_json()
    assert [(s["name"], s["score"]) for s in body["scores"]] == [("Rev", 9000)]
    # 같은 run으로 점수가 줄거나 이름이 바뀌면 거부
    assert client.post("/api/scores", json=score_payload(name="Rev", run=run, score=8000, wave=7, seconds=270, kills=71)).status_code == 409
    assert client.post("/api/scores", json=score_payload(name="Other", run=run, score=9900, wave=8, seconds=300, kills=80)).status_code == 409


# ── 텔레메트리·통계 ──
def test_runs_and_stats(client):
    assert client.post("/api/runs", json=run_payload(wave=3, seconds=90, kills=20, score=3000)).status_code == 201
    assert client.post("/api/runs", json=run_payload(wave=7, seconds=300, kills=90, score=20000, death="drain",
                                                    mods="TimeLeech=2", rifle=1500, rail=20, grenades=8)).status_code == 201
    assert client.post("/api/runs", json=run_payload(arena="foundry", board="std-foundry", wave=5, seconds=200, kills=50,
                                                    score=9000, quality=0)).status_code == 201
    assert client.get("/api/stats").status_code == 403
    assert client.get("/api/stats?key=wrong").status_code == 403
    r = client.get("/api/stats?key=admin-secret")
    s = r.get_json()
    assert r.status_code == 200 and s["runs"] == 3
    neon = next(g for g in s["by_arena_mode"] if g["arena"] == "neon")
    assert neon["runs"] == 2 and neon["median_seconds"] == 195 and neon["median_wave"] == 5
    assert s["wave_histogram"] == {"3": 1, "5": 1, "7": 1}
    assert s["death_causes"] == {"hit": 2, "drain": 1}
    assert s["weapons"]["rail_shots"] == 44 and s["weapons"]["grenades"] == 18
    assert s["mods"]["TimeLeech"] == {"runs": 3, "levels": 4, "pick_rate": 1.0}
    assert s["quality"] == {"2": 2, "0": 1}
    assert client.get("/api/stats", headers={"X-Admin-Key": "admin-secret"}).status_code == 200


def test_run_upsert_on_revive(client):
    p = run_payload(run="00000000000000bb", wave=4, seconds=120, kills=30, score=4000)
    assert client.post("/api/runs", json=p).status_code == 201
    p2 = run_payload(run="00000000000000bb", wave=6, seconds=200, kills=55, score=9000, revives=1)
    r = client.post("/api/runs", json=p2)
    assert r.status_code == 200 and r.get_json()["updated"] is True
    s = client.get("/api/stats?key=admin-secret").get_json()
    assert s["runs"] == 1 and s["wave_histogram"] == {"6": 1} and s["revive_rate"] == 1.0


def test_run_validation(client):
    assert client.post("/api/runs", json=run_payload(mode="weird")).get_json()["error"] == "invalid_mode"
    assert client.post("/api/runs", json=run_payload(mods="Bad Mod=1")).get_json()["error"] == "invalid_mods"
    assert client.post("/api/runs", json=run_payload(quality=5)).get_json()["error"] == "invalid_quality"
    assert client.post("/api/runs", json=run_payload(mods="")).status_code == 201


def test_stats_disabled_without_admin_key(make_app):
    c = make_app(FPS_ADMIN_KEY="").test_client()
    assert c.get("/api/stats?key=").status_code == 404


def test_unknown_route_json(client):
    r = client.get("/nope")
    assert r.status_code == 404 and r.get_json()["error"] == "not_found"
