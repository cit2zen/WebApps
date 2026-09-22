"""저장소 — SQLAlchemy Core. Postgres(DATABASE_URL, 공유 DB라 테이블은 fps_ 접두) · 미설정이면 SQLite 폴백.
테이블은 시작 시 자동 생성(checkfirst)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import (Column, DateTime, Index, Integer, MetaData, String, Table, UniqueConstraint,
                        and_, create_engine, func, select)
from sqlalchemy.exc import IntegrityError

metadata = MetaData()

scores = Table(
    "fps_scores", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("board", String(40), nullable=False),
    Column("run_id", String(32), nullable=False),
    Column("name", String(24), nullable=False),
    Column("name_key", String(48), nullable=False),     # 소문자 정규화 — 보드당 이름별 최고 기록 1줄
    Column("score", Integer, nullable=False),
    Column("wave", Integer, nullable=False),
    Column("seconds", Integer, nullable=False),
    Column("kills", Integer, nullable=False),
    Column("revived", Integer, nullable=False, default=0),
    Column("version", String(24), nullable=False),
    Column("ip_hash", String(32), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("board", "run_id", name="uq_fps_scores_board_run"),
    Index("ix_fps_scores_board_score", "board", "score"),
)

runs = Table(
    "fps_runs", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", String(32), nullable=False, unique=True),
    Column("board", String(40), nullable=False),
    Column("arena", String(24), nullable=False),
    Column("mode", String(8), nullable=False),
    Column("wave", Integer, nullable=False),
    Column("seconds", Integer, nullable=False),
    Column("kills", Integer, nullable=False),
    Column("score", Integer, nullable=False),
    Column("death", String(16), nullable=False),
    Column("mods", String(400), nullable=False),        # "HollowPoint=2;TimeLeech=1"
    Column("rifle", Integer, nullable=False),
    Column("rail", Integer, nullable=False),
    Column("grenades", Integer, nullable=False),
    Column("quality", Integer, nullable=False),
    Column("revives", Integer, nullable=False),
    Column("version", String(24), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Index("ix_fps_runs_created", "created_at"),
)


def now():
    return datetime.now(timezone.utc)


def make_engine(url: str):
    kw = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kw["connect_args"] = {"check_same_thread": False}
    engine = create_engine(url, **kw)
    metadata.create_all(engine)
    return engine


# ── 점수 ─────────────────────────────────────────────────────────────
def find_run_score(conn, board, run_id):
    return conn.execute(select(scores).where(and_(scores.c.board == board, scores.c.run_id == run_id))).mappings().first()


def recent_same(conn, row, minutes=10):
    """같은 이름·같은 결과가 최근에 이미 있으면(재전송·리플레이) True"""
    since = now() - timedelta(minutes=minutes)
    q = select(scores.c.id).where(and_(
        scores.c.board == row["board"], scores.c.name_key == row["name_key"], scores.c.score == row["score"],
        scores.c.wave == row["wave"], scores.c.seconds == row["seconds"], scores.c.kills == row["kills"],
        scores.c.created_at >= since)).limit(1)
    return conn.execute(q).first() is not None


def insert_score(conn, row):
    """삽입. 동시 요청이 유니크 제약에 걸리면 False"""
    try:
        conn.execute(scores.insert().values(**row, created_at=now()))
        return True
    except IntegrityError:
        return False


def update_score(conn, sid, row):
    fields = {k: row[k] for k in ("score", "wave", "seconds", "kills", "revived", "version")}
    conn.execute(scores.update().where(scores.c.id == sid).values(**fields))


def _best_per_name(board):
    """보드 안에서 이름별 최고 기록 1줄(동점이면 먼저 낸 기록)"""
    rn = func.row_number().over(partition_by=scores.c.name_key, order_by=(scores.c.score.desc(), scores.c.id.asc()))
    inner = select(scores.c.id, scores.c.name, scores.c.name_key, scores.c.score, scores.c.wave, scores.c.seconds,
                   scores.c.kills, rn.label("rn")).where(scores.c.board == board).subquery()
    return select(inner.c.name, inner.c.name_key, inner.c.score, inner.c.wave, inner.c.seconds, inner.c.kills) \
        .where(inner.c.rn == 1).order_by(inner.c.score.desc(), inner.c.id.asc())


def rank_of(conn, board, score, name_key=None):
    """경쟁 순위(1 + 이 점수보다 높은 최고 기록을 가진 다른 이름 수)"""
    cond = [scores.c.board == board, scores.c.score > score]
    if name_key:
        cond.append(scores.c.name_key != name_key)
    n = conn.execute(select(func.count(func.distinct(scores.c.name_key))).where(and_(*cond))).scalar() or 0
    return n + 1


def total_players(conn, board):
    return conn.execute(select(func.count(func.distinct(scores.c.name_key))).where(scores.c.board == board)).scalar() or 0


def best_of(conn, board, name_key):
    return conn.execute(select(func.max(scores.c.score)).where(
        and_(scores.c.board == board, scores.c.name_key == name_key))).scalar()


def ranked_rows(conn, board, offset, limit):
    rows = conn.execute(_best_per_name(board).offset(offset).limit(limit)).mappings().all()
    out = []
    for i, r in enumerate(rows):
        # 첫 줄만 조회, 이후는 목록 위치로 유도(동점 = 같은 순위, 다르면 절대 위치 + 1)
        if i == 0:
            rank = rank_of(conn, board, r["score"], r["name_key"])
        elif r["score"] == rows[i - 1]["score"]:
            rank = out[-1]["rank"]
        else:
            rank = offset + i + 1
        out.append({"rank": rank, "name": r["name"], "score": r["score"],
                    "wave": r["wave"], "seconds": r["seconds"], "kills": r["kills"]})
    return out


# ── 텔레메트리 ───────────────────────────────────────────────────────
def upsert_run(conn, row):
    """run_id당 1줄 — 부활한 판의 두 번째 게임오버는 같은 줄을 최종 값으로 교체"""
    found = conn.execute(select(runs.c.id).where(runs.c.run_id == row["run_id"])).first()
    if found:
        conn.execute(runs.update().where(runs.c.id == found[0]).values(**row))
        return False
    try:
        conn.execute(runs.insert().values(**row, created_at=now()))
    except IntegrityError:
        conn.execute(runs.update().where(runs.c.run_id == row["run_id"]).values(**row))
        return False
    return True


def recent_runs(conn, days, version=None, limit=50000):
    cond = [runs.c.created_at >= now() - timedelta(days=days)]
    if version:
        cond.append(runs.c.version == version)
    q = select(runs).where(and_(*cond)).order_by(runs.c.id.desc()).limit(limit)
    return conn.execute(q).mappings().all()
