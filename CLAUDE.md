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

## Git / 배포
- 원격 저장소: https://github.com/cit2zen/WebApps (브랜치 `main`)
- 모든 웹앱 프로젝트는 이 저장소에 푸시한다. **각 프로젝트는 자기 하위 폴더**에 둔다 (예: `yaong/`).
- `.gitignore`는 화이트리스트 방식 — 새 프로젝트를 추가하면 `!/<폴더명>` 한 줄을 더한다.
- 스크린샷 PNG 등 산출물은 커밋하지 않는다.

### "배포해줘" 동작 (자동 수행)
사용자가 "배포"/"배포해줘"라고 하면 별도 질문 없이 다음을 수행한다:
1. 새 프로젝트 폴더면 `.gitignore`에 `!/<폴더명>` 추가.
2. 해당 프로젝트 폴더 + 변경된 `.gitignore`/`CLAUDE.md`를 `git add`.
3. `git commit` (메시지는 작업 내용 요약, 한국어).
4. `git push origin main`.
5. 푸시 성공 후 GitHub Pages URL 형태를 안내한다: `https://cit2zen.github.io/WebApps/<폴더명>/`
   (Pages가 아직 활성화돼 있지 않으면 저장소 Settings → Pages에서 `main` 브랜치 활성화가 필요함을 안내.)
