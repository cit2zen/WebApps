import os
from datetime import date

from dotenv import load_dotenv

load_dotenv()

# 공유 홈서버 Postgres(pgvector) 사용. 로컬 개발 기본값은 localhost.
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/onmantle"
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
# 드라이버 명시: SQLAlchemy 2.1부터 postgresql:// 기본 드라이버가 psycopg(v3)로 바뀌어
# 설치된 psycopg2-binary와 어긋나면 워커가 부팅 실패한다(2026-09-27 장애).
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# 퍼즐 번호 기준일과 시크릿 개수 (하루 3슬롯 × 회전)
BASE_DATE = date(2026, 4, 11)
NUM_SECRETS = 21
