# fps-api — Overclock Arena 글로벌 랭킹 + 익명 텔레메트리

Flask JSON API (`wsgi:app`). 클라이언트 = Unity WebGL `develop_web/UnityFPS/Assets/Scripts/Online/`(games.cityzen.kr/fps · CrazyGames).
저장소 = Postgres(`DATABASE_URL`, 공유 DB라 테이블 `fps_scores`·`fps_runs` 접두) · 미설정이면 SQLite 파일 폴백. 테이블은 시작 시 자동 생성.

## 엔드포인트
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/scores` | `{name, board, score, wave, seconds, kills, revived, version, run, sig}` → `201 {rank, total, best, best_rank, name}` |
| GET | `/api/scores?board=&limit=20` | 보드 TOP N(이름별 최고 기록 1줄, 경쟁 순위 — 동점 = 같은 순위) |
| GET | `/api/scores/around?board=&score=[&name=]` | 이 점수의 순위 + 위아래 2줄 |
| POST | `/api/runs` | 판 텔레메트리(개인정보 없음) — `run_id`당 1줄, 부활 후 재전송은 교체 |
| GET | `/api/stats?key=<FPS_ADMIN_KEY>[&days=30&version=]` | 밸런싱 집계(아레나·모드별 중앙 생존 시간·웨이브 분포·무기·모듈·사망 원인). 키 미설정이면 404 |
| GET | `/healthz` | DB 연결 확인 |

오류는 `{"error": 코드}` — 400 형식 · 401 `bad_signature` · 409 `duplicate` · 422 `implausible`(+`reason`) · 429 `rate_limited`(+`Retry-After`).

## 부정 방지(한계 포함)
- **서명**: `HMAC-SHA256(FPS_API_KEY, "v1|score|board|name|score|wave|seconds|kills|revived|version|run")`(텔레메트리는 `v1|run|run|board|wave|seconds|kills|score|version`). 키는 클라이언트 빌드에 들어 있어 **추출 가능** — 스크립트 조작의 문턱일 뿐이다.
- **그럴듯함**(`validate.py`): 처치 수 ≤ 45×웨이브, 클리어 웨이브당 ≥ 2초, 처치율 ≤ 5/초, 생존 시간 ≤ 벌 수 있는 총 시계, 점수 ≤ Tuning 유도 상한 × `FPS_SCORE_SLACK`. **게임 점수 규칙(Tuning.cs)을 바꾸면 여기 상수도 확인.**
- **중복**: `(board, run)` 유니크 — 같은 판 재제출은 같은 이름·단조 증가(부활 이어하기)만 교체, 같은 결과 10분 내 재전송 거부.
- **레이트 리밋**: IP 해시별 토큰 버킷(점수 6개/10초당 1개 보충). 인메모리·워커별 → gunicorn 워커 1 + 스레드 4.
- **IP**: 원본 저장 안 함. `HMAC(FPS_IP_SALT, ip)` 앞 24자만. 솔트 미설정이면 프로세스마다 무작위.
- **CORS**: games.cityzen.kr · 127.0.0.1/localhost:8777 · `*.crazygames.<지역 TLD>`(게임 iframe `*.game-files.crazygames.com` 포함) · `*.1001juegos.com` · CrazyGames 앱 오리진. CORS는 브라우저 규칙일 뿐 인증이 아니다.

## 로컬
```powershell
cd develop_web/WebApps/fps-api
python -m pytest -q          # SQLite 폴백, 네트워크 불필요
python app.py                # http://127.0.0.1:5000 (Unity 에디터 기본 API 주소)
```

## 배포(홈서버 Coolify — `/deploy` 스킬 §2 신규 앱)
1. WebApps `.gitignore`에 `!/fps-api` 추가 → 커밋·푸시.
2. `python develop_web/scripts/hs_deploy.py create-dockerfile fps-api /fps-api fps-api.cityzen.kr 8000` → 응답 uuid를 `services.json`에 `host: "home-server"`, `coolifyUuid`로 기록.
3. Coolify 환경 변수: `DATABASE_URL`(shared-postgres) · `FPS_API_KEY`(= Unity `OnlineConfig.Key`) · `FPS_ADMIN_KEY` · `FPS_IP_SALT`(고정 무작위) → `hs_deploy.py env fps-api`로 키 존재만 확인.
4. `python develop_web/scripts/cf_dns.py ingress-add fps-api.cityzen.kr` → `cf_dns.py to-tunnel fps-api.cityzen.kr`.
5. `hs_deploy.py deploy fps-api`(exit 0) → `python develop_web/scripts/verify_live.py fps-api.cityzen.kr/healthz '"db":true'`.
6. DB 백업: 공유 DB(`postgres`)에 있으면 기존 Coolify 스케줄 백업·오프사이트 cron에 자동 포함.
