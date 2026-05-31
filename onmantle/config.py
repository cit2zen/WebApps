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

# 퍼즐 번호 기준일과 시크릿 개수 (하루 3슬롯 × 회전)
BASE_DATE = date(2026, 4, 11)
NUM_SECRETS = 21
