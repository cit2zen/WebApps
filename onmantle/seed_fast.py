"""느린 seed 가속 래퍼: execute_values page_size를 키워 왕복 횟수를 줄인다.
   (배포 산출물 아님 — 로컬 시드 전용, 미커밋)"""
import os
import psycopg2
import psycopg2.extras as E

# 1) 이전 시드의 잔여 커넥션(idle in transaction) 정리 — DROP TABLE 락 대기 방지
_url = os.environ["DATABASE_URL"]
_c = psycopg2.connect(_url, connect_timeout=20)
_c.autocommit = True
_cur = _c.cursor()
_cur.execute(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
    "WHERE datname='onmantle' AND pid <> pg_backend_pid()"
)
_cur.close()
_c.close()

# 2) execute_values 기본 page_size=100 → 10000 (왕복 수십배 감소)
_orig = E.execute_values
def _fast(cur, sql, argslist, template=None, page_size=10000, fetch=False):
    return _orig(cur, sql, argslist, template, page_size, fetch)
E.execute_values = _fast

# 3) 원본 seed 실행 (위 패치 이후 import → seed가 패치된 함수를 바인딩)
import seed
seed.main()
