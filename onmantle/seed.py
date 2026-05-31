"""온맨틀 데이터 시드: SQLite(_data/onmantle_deploy.db.gz) → Postgres(pgvector).

홈서버 VM(또는 공유 Postgres에 접근 가능한 곳)에서 1회 실행한다.
사전계산 similarities 테이블은 옮기지 않는다 — 유사도는 런타임에 pgvector로 즉석 계산.
numpy 비의존(stdlib array로 float32 파싱).

  DATABASE_URL=postgresql://... python seed.py
"""
import array
import gzip
import os
import shutil
import sqlite3
import tempfile

from sqlalchemy import create_engine, text

from config import DATABASE_URL

GZ = os.path.join(os.path.dirname(__file__), "_data", "onmantle_deploy.db.gz")
BATCH = 1000


def _decompress() -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    with gzip.open(GZ, "rb") as fi, open(tmp.name, "wb") as fo:
        shutil.copyfileobj(fi, fo)
    return tmp.name


def _vec_literal(blob: bytes) -> str:
    v = array.array("f")  # native float32 (리틀엔디안 x86)
    v.frombytes(blob)
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def main() -> None:
    if not os.path.exists(GZ):
        raise SystemExit(f"소스 DB 없음: {GZ}")
    sq = sqlite3.connect(_decompress())
    sq.row_factory = sqlite3.Row
    eng = create_engine(DATABASE_URL)

    with eng.begin() as cx:
        cx.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        cx.execute(text("DROP TABLE IF EXISTS nearest, secrets, words CASCADE"))
        cx.execute(text("CREATE TABLE words (word TEXT PRIMARY KEY, vec vector(300) NOT NULL)"))
        cx.execute(text("CREATE TABLE secrets (idx INTEGER PRIMARY KEY, word TEXT NOT NULL, pos TEXT)"))
        cx.execute(text(
            "CREATE TABLE nearest (secret_idx INTEGER, rank INTEGER, word TEXT NOT NULL, "
            "similarity DOUBLE PRECISION NOT NULL, PRIMARY KEY (secret_idx, rank))"
        ))
        cx.execute(text("CREATE INDEX ix_nearest_secret_word ON nearest (secret_idx, word)"))

        # words (BLOB float32 → pgvector 리터럴)
        ins_w = text("INSERT INTO words (word, vec) VALUES (:w, CAST(:v AS vector))")
        batch, total = [], 0
        for r in sq.execute("SELECT word, vec FROM words"):
            batch.append({"w": r["word"], "v": _vec_literal(r["vec"])})
            if len(batch) >= BATCH:
                cx.execute(ins_w, batch); total += len(batch); batch = []
        if batch:
            cx.execute(ins_w, batch); total += len(batch)
        print(f"words: {total}")

        # secrets
        secs = [dict(idx=r["idx"], word=r["word"], pos=r["pos"]) for r in sq.execute("SELECT idx, word, pos FROM secrets")]
        if secs:
            cx.execute(text("INSERT INTO secrets (idx, word, pos) VALUES (:idx, :word, :pos)"), secs)
        print(f"secrets: {len(secs)}")

        # nearest
        ins_n = text("INSERT INTO nearest (secret_idx, rank, word, similarity) VALUES (:s, :r, :w, :sim)")
        batch, total = [], 0
        for r in sq.execute("SELECT secret_idx, rank, word, similarity FROM nearest"):
            batch.append({"s": r["secret_idx"], "r": r["rank"], "w": r["word"], "sim": r["similarity"]})
            if len(batch) >= BATCH:
                cx.execute(ins_n, batch); total += len(batch); batch = []
        if batch:
            cx.execute(ins_n, batch); total += len(batch)
        print(f"nearest: {total}")

    print("seed 완료")


if __name__ == "__main__":
    main()
