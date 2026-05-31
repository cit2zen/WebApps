"""온맨틀 데이터 시드: SQLite(_data/onmantle_deploy.db.gz) → Postgres.

홈서버 VM(또는 공유 Postgres에 접근 가능한 곳)에서 1회 실행한다.
유사도는 런타임 계산이 아니라 사전계산된 similarities 테이블을 직접 조회한다
(pgvector/벡터 불필요). similarities는 약 385만 행이므로 적재 성능이 중요 →
psycopg2 execute_values로 배치 적재하고, 대량 INSERT 동안 인덱스가 없도록
PK는 적재 완료 후 ALTER TABLE로 추가한다.

  DATABASE_URL=postgresql://... python seed.py
"""
import gzip
import os
import shutil
import sqlite3
import tempfile

from sqlalchemy import create_engine
from psycopg2.extras import execute_values

from config import DATABASE_URL

GZ = os.path.join(os.path.dirname(__file__), "_data", "onmantle_deploy.db.gz")
BATCH = 10000


def _decompress() -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    with gzip.open(GZ, "rb") as fi, open(tmp.name, "wb") as fo:
        shutil.copyfileobj(fi, fo)
    return tmp.name


def _bulk_copy(pg, sql_select, sq, insert_sql):
    """SQLite 커서를 배치로 읽어 execute_values로 Postgres에 적재."""
    cur = pg.cursor()
    batch, total = [], 0
    for r in sq.execute(sql_select):
        batch.append(tuple(r))
        if len(batch) >= BATCH:
            execute_values(cur, insert_sql, batch)
            total += len(batch)
            batch = []
            print(f"  ...{total}")
    if batch:
        execute_values(cur, insert_sql, batch)
        total += len(batch)
    cur.close()
    return total


def main() -> None:
    if not os.path.exists(GZ):
        raise SystemExit(f"소스 DB 없음: {GZ}")
    sq = sqlite3.connect(_decompress())

    eng = create_engine(DATABASE_URL)
    raw = eng.raw_connection()  # psycopg2 connection
    try:
        pg = raw.connection if hasattr(raw, "connection") else raw
        cur = pg.cursor()

        # 기존 게임 데이터 제거 후 인덱스 없는 빈 테이블 생성(대량 적재용)
        print("테이블 재생성")
        cur.execute("DROP TABLE IF EXISTS similarities, nearest, secrets CASCADE")
        cur.execute(
            "CREATE TABLE secrets (idx INTEGER PRIMARY KEY, word TEXT NOT NULL, pos TEXT)"
        )
        cur.execute(
            "CREATE TABLE nearest ("
            "secret_idx INTEGER, rank INTEGER, word TEXT NOT NULL, "
            "similarity DOUBLE PRECISION NOT NULL, "
            "PRIMARY KEY (secret_idx, rank))"
        )
        # similarities는 PK 없이 먼저 만들고 적재 후 ALTER로 PK 부여(적재 속도)
        cur.execute(
            "CREATE TABLE similarities ("
            "secret_idx INTEGER, word TEXT NOT NULL, "
            "similarity DOUBLE PRECISION NOT NULL, rank INTEGER)"
        )
        cur.close()
        pg.commit()

        # secrets
        n = _bulk_copy(
            pg,
            "SELECT idx, word, pos FROM secrets",
            sq,
            "INSERT INTO secrets (idx, word, pos) VALUES %s",
        )
        pg.commit()
        print(f"secrets: {n}")

        # nearest
        n = _bulk_copy(
            pg,
            "SELECT secret_idx, rank, word, similarity FROM nearest",
            sq,
            "INSERT INTO nearest (secret_idx, rank, word, similarity) VALUES %s",
        )
        pg.commit()
        print(f"nearest: {n}")

        # similarities (약 385만 행 — 인덱스 없이 적재)
        print("similarities 적재 시작(약 385만 행)")
        n = _bulk_copy(
            pg,
            "SELECT secret_idx, word, similarity, rank FROM similarities",
            sq,
            "INSERT INTO similarities (secret_idx, word, similarity, rank) VALUES %s",
        )
        pg.commit()
        print(f"similarities: {n}")

        # 적재 완료 후 PK 생성((secret_idx, word)이 조회 인덱스 역할)
        print("similarities PK 생성")
        cur = pg.cursor()
        cur.execute(
            "ALTER TABLE similarities ADD PRIMARY KEY (secret_idx, word)"
        )
        cur.close()
        pg.commit()
    finally:
        raw.close()
        sq.close()

    print("seed 완료")


if __name__ == "__main__":
    main()
