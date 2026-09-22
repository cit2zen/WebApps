import os
import sys
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from security import run_parts, score_parts, sign  # noqa: E402

KEY = "test-key"
ADMIN = "admin-secret"


@pytest.fixture
def make_app(tmp_path):
    def _make(**overrides):
        cfg = {
            "TESTING": True,
            "DATABASE_URL": "sqlite:///" + str(tmp_path / "t.sqlite3"),
            "FPS_API_KEY": KEY,
            "FPS_ADMIN_KEY": ADMIN,
            "FPS_IP_SALT": "salt",
            "FPS_IP_HEADER": "CF-Connecting-IP",
            "RATE_SCORES": (1000, 100.0),
            "RATE_RUNS": (1000, 100.0),
            "RATE_READ": (1000, 100.0),
        }
        cfg.update(overrides)
        return create_app(cfg)
    return _make


@pytest.fixture
def client(make_app):
    return make_app().test_client()


_seq = [0]


def run_id():
    _seq[0] += 1
    return f"{_seq[0]:016x}"


def score_payload(key=KEY, **kw):
    p = {"name": "Cityzen", "board": "std-neon", "score": 12000, "wave": 6, "seconds": 180, "kills": 60,
         "revived": 0, "version": "1.0.0", "run": run_id()}
    p.update(kw)
    p["sig"] = sign(key, score_parts(p))
    return p


def run_payload(key=KEY, **kw):
    p = {"run": run_id(), "board": "std-neon", "arena": "neon", "mode": "std", "wave": 6, "seconds": 180, "kills": 60,
         "score": 12000, "death": "hit", "mods": "HollowPoint=2;TimeLeech=1", "rifle": 900, "rail": 12, "grenades": 5,
         "quality": 2, "revives": 0, "version": "1.0.0"}
    p.update(kw)
    p["sig"] = sign(key, run_parts(p))
    return p


def today_board():
    return "daily-" + datetime.now(timezone.utc).strftime("%Y%m%d")
