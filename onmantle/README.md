# 온맨틀 (onmantle)

[Semantle](https://semantle.com/) → [꼬맨틀](https://semantle-ko.newsjel.ly/) 계열 한국어 단어 유사도 추측 게임.
Flask 백엔드가 정적 프론트(`static/`)와 `/api`를 같은 오리진에서 서빙한다.

## 구조
- `static/` — 프론트(바닐라 JS). API는 같은 오리진 `/api/*` 호출.
- `app.py` `routes.py` `models.py` — Flask + SQLAlchemy + Postgres.
- 유사도: 사전계산된 `similarities` 테이블(시크릿별 전체 어휘 × 유사도, 약 385만 행)을 직접 조회. 값은 이미 -100~100 스케일(자기 자신=100.0). 순위는 같은 테이블의 `rank`(상위 1000위만 채워짐)와 `nearest`(상위 1000) 조회. pgvector·런타임 벡터 계산 불필요.
- `seed.py` — `secrets`·`nearest`·`similarities`를 SQLite에서 Postgres로 1회 적재.

## 로컬 실행
```
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/onmantle
python seed.py     # _data/onmantle_deploy.db.gz 필요
python app.py      # http://localhost:5000
```

## 배포 (홈서버 Coolify)
- 빌드팩 **Nixpacks** (Python), 시작: `gunicorn wsgi:app --bind 0.0.0.0:$PORT` (Procfile 동봉).
- Base Directory `onmantle`, FQDN `http://onmantle.cityzen.kr` (Force HTTPS OFF), 터널 ingress+DNS 추가.
- `DATABASE_URL`은 Coolify Env에만. 공유 Postgres에 `onmantle` DB 생성 후 **seed.py 1회 실행**(VM에서, `_data/*.gz` 동반). 약 385만 행이라 수 분 소요될 수 있음.
- `_data/`·`.env`·`*.db*`는 git 비추적.
