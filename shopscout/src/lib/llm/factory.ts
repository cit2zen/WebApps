import type { LlmClient } from './client';
import { AgentSdkClient } from './agentSdkClient';
import { ApiLlmClient } from './apiClient';
import { DevMockLlmClient } from './devMockClient';

/**
 * 환경변수 SHOPSCOUT_LLM에 따라 LLM 클라이언트를 만든다.
 * - mock: 스크립트 목(자격증명 없이 전체 플로우 시연/E2E)
 * - api: Anthropic API 키 사용(서버 배포 권장) — ANTHROPIC_API_KEY 필요
 * - agent-sdk(기본): Claude Code 구독 자격증명(로컬/CLI). 서버(next start)에서는 CLI·OAuth가 없어 실패할 수 있음.
 *
 * 자동 선택: SHOPSCOUT_LLM 미지정이고 ANTHROPIC_API_KEY가 있으면 api 모드로 동작(서버 안전).
 */
const KNOWN_MODES = new Set(['mock', 'api', 'agent-sdk']);

export function makeLlm(): LlmClient {
  const explicit = process.env.SHOPSCOUT_LLM;
  // 명시적으로 준 값이 오타/미지원이면 조용히 agent-sdk로 폴백하지 말고 조기 실패
  if (explicit && !KNOWN_MODES.has(explicit)) {
    throw new Error(`알 수 없는 SHOPSCOUT_LLM=${explicit} (가능: mock|api|agent-sdk)`);
  }
  const mode = explicit ?? (process.env.ANTHROPIC_API_KEY ? 'api' : 'agent-sdk');
  switch (mode) {
    case 'mock':
      return new DevMockLlmClient();
    case 'api':
      return new ApiLlmClient({ model: process.env.SHOPSCOUT_MODEL });
    case 'agent-sdk':
    default:
      return new AgentSdkClient({ model: process.env.SHOPSCOUT_MODEL });
  }
}
