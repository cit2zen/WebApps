from datetime import date

import pytest

import validate as v
from conftest import score_payload, today_board


@pytest.mark.parametrize("raw,expected", [
    ("Cityzen", "Cityzen"), ("  neo  one ", "neo one"), ("김철수", "김철수"), ("a_b-c 9", "a_b-c 9"), ("ab", "ab"),
    ("123456789012", "123456789012"),
])
def test_name_ok(raw, expected):
    assert v.clean_name(raw) == (expected, None)


@pytest.mark.parametrize("raw", ["a", "1234567890123", "", "   ", "bad|pipe", "<script>", "émile", "tab\tname!", None, 12])
def test_name_invalid(raw):
    assert v.clean_name(raw) == (None, "invalid_name")


@pytest.mark.parametrize("raw", ["fuck", "Fu_ck you", "sh1t", "b1tch", "씨발", "병 신", "N1GG4"])
def test_name_profanity(raw):
    assert v.clean_name(raw) == (None, "name_rejected")


def test_board_rules():
    assert v.check_board("std-neon")
    assert v.check_board("std-neon_2")
    assert v.check_board("daily-20260922", today=date(2026, 9, 22))
    assert v.check_board("daily-20260921", today=date(2026, 9, 22))      # 자정 걸친 판
    assert v.check_board("daily-20260919", today=date(2026, 9, 22)) is None
    assert v.check_board("daily-20261340", today=date(2026, 9, 22)) is None
    assert v.check_board("STD-neon") is None
    assert v.check_board("weekly-1") is None
    assert v.check_board(None) is None


def test_as_int_rejects_non_ints():
    assert v.as_int(5, 0, 10) == 5
    assert v.as_int(True, 0, 10) is None
    assert v.as_int(5.0, 0, 10) is None
    assert v.as_int("5", 0, 10) is None
    assert v.as_int(11, 0, 10) is None


@pytest.mark.parametrize("field,value,code", [
    ("score", "100", "invalid_score"), ("wave", 0, "invalid_wave"), ("seconds", -1, "invalid_seconds"),
    ("kills", 1.5, "invalid_kills"), ("run", "XYZ", "invalid_run"), ("version", "1.0 beta", "invalid_version"),
    ("board", "std-", "invalid_board"), ("revived", 2, "invalid_revived"),
])
def test_submit_rejects_bad_fields(client, field, value, code):
    r = client.post("/api/scores", json=score_payload(**{field: value}))
    assert r.status_code == 400
    assert r.get_json()["error"] == code


def test_submit_rejects_bad_name(client):
    assert client.post("/api/scores", json=score_payload(name="x")).get_json()["error"] == "invalid_name"
    assert client.post("/api/scores", json=score_payload(name="shit head")).get_json()["error"] == "name_rejected"


def test_submit_non_json(client):
    r = client.post("/api/scores", data="nope", content_type="text/plain")
    assert r.status_code == 400


def test_daily_board_accepted(client):
    r = client.post("/api/scores", json=score_payload(board=today_board()))
    assert r.status_code == 201
