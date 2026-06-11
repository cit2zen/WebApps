# WebApps 모노레포 컨벤션

## 스택
- 기본: 빌드 스텝 없는 vanilla HTML/CSS/JS (ES modules, CDN import만 허용).
- 서버 필요 앱은 **Flask** 허용(balancegame·onmantle·studyai 전례), Agent SDK 앱은 Next.js/Node(Dockerfile).

## 코딩 규칙 (정적앱)
- 함수 단일 책임, 파일당 200줄 이하 권장.
- 게임 루프는 requestAnimationFrame, setInterval 금지.

## Flask 규칙
- 진입점 `wsgi:app` + Procfile `web: gunicorn wsgi:app --bind 0.0.0.0:$PORT`.
- 템플릿 autoescape 유지(`|safe` 남용 금지), 비밀번호·DB 접속은 환경변수로, DB는 Postgres(psycopg2/SQLAlchemy).
- 업로드 파일은 영속 볼륨 경로(`uploads/`), Pillow로 처리.

## 실행 & 검증
- 로컬: Live Server(정적) / `flask run`(Flask).
- 검증 기준·배포 후 smoke는 **루트 `C:\factory\CLAUDE.md` 「검증 워크플로」가 단일 출처**(Playwright 스크린샷 + console.error 0개 등).

## Git / 배포
- 원격 https://github.com/cit2zen/WebApps (`main`), 각 앱 = 자기 하위 폴더.
- 이 폴더가 cit2zen/WebApps **직접 클론**(단일 소스) — 여기서 수정·커밋·푸시. 배포·도메인·호스팅 현황은 루트 CLAUDE.md 「배포」가 단일 출처.
- `.gitignore` 화이트리스트 — 새 앱이면 `!/<폴더명>` 한 줄 추가. 스크린샷 등 산출물 커밋 금지.
