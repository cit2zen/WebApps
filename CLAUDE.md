# 프로젝트 컨벤션

## 스택
- 빌드 스텝 없는 vanilla HTML/CSS/JS (ES modules)
- 프레임워크/번들러 없음. CDN import만 허용.

## 실행 & 테스트
- 로컬 확인: VS Code Live Server (각 폴더의 index.html)
- 변경 후 반드시 Playwright MCP로 페이지 열어 스크린샷 + console 에러 확인
- console.error / 빨간 줄 0개가 "통과" 기준
- 자동 검증으로 끝나지 않고 사용자(사람)의 직접 테스트가 필요한 시점에는, 웹을 직접 열지 말고 접속 링크를 제시하면서 무엇을 확인해야 하는지 명시하여 사용자에게 테스트를 요청한다.

## 코딩 규칙
- 함수는 단일 책임, 파일당 200줄 이하 권장
- 게임 루프는 requestAnimationFrame, setInterval 금지

## 도구
- 브라우저 확인/검증은 반드시 Playwright MCP를 활용한다.
- 페이지 열기, 스크린샷 캡처, console 에러 확인 등 모든 동작 검증에 Playwright MCP를 사용한다.

## Git / 배포 (홈서버 일원화)
- 원격 저장소: https://github.com/cit2zen/WebApps (브랜치 `main`). **각 프로젝트는 자기 하위 폴더** (예: `yaong/`).
- `.gitignore`는 화이트리스트 — 새 프로젝트면 `!/<폴더명>` 한 줄 추가. 스크린샷 등 산출물 커밋 금지.
- 배포 대상은 **cityzen 홈서버**(Coolify 폴더별 서비스 → `<폴더명>.cityzen.kr`). GitHub Pages는 폐지.
- **전체 워크플로·인프라 고정값·"배포해줘" 자동 동작은 루트 `C:\factory\CLAUDE.md` 참조** (단일 출처).
