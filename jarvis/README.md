# JARVIS — 음성 대화형 AI

Claude 두뇌(Agent SDK 구독 인증) + 브라우저 음성(STT/TTS) + react-three-fiber 그래픽.
사용자의 한국어 음성에 실시간 반응하는 오브+파티클 네뷸라.

## 요구사항
- Node 18+ / Chrome 또는 Edge
- Claude Code 로그인 + 구독(Pro/Max). `claude setup-token`으로 OAuth 토큰 발급.

## 설정
1. `npm install`
2. `.env.local` 작성:
   ```
   CLAUDE_CODE_OAUTH_TOKEN=<발급 토큰>
   JARVIS_MODEL=sonnet
   ```
   ⚠️ `ANTHROPIC_API_KEY`는 넣지 마세요(구독이 아닌 API 종량제로 청구됨).
3. `npm run dev` → http://localhost:3000 (Chrome/Edge)
4. "음성으로 대화 시작" 클릭 → 마이크 허용.

## 기능
- 음성 대화(한국어), 웹검색·시간·메모리 도구, 리서치 에이전트 팀, 끼어들기(barge-in).
- 상태 비주얼: 대기/듣는 중/사고 중/답변 중.

## 테스트
- `npm test` (단위) · `npm run e2e` (시각 스냅샷)

## 향후 (v2)
- 홈서버 배포(Coolify+Cloudflare), ElevenLabs 고급 음성(진짜 파형 반응), 카메라/멀티모달.
