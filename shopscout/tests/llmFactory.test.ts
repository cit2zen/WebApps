import { describe, it, expect, afterEach } from 'vitest';
import { makeLlm } from '@/lib/llm/factory';
import { DevMockLlmClient } from '@/lib/llm/devMockClient';
import { ApiLlmClient } from '@/lib/llm/apiClient';
import { AgentSdkClient } from '@/lib/llm/agentSdkClient';

const saved = { ...process.env };
afterEach(() => {
  process.env.SHOPSCOUT_LLM = saved.SHOPSCOUT_LLM;
  process.env.ANTHROPIC_API_KEY = saved.ANTHROPIC_API_KEY;
});

describe('makeLlm 모드 선택', () => {
  it('mock 모드 → DevMockLlmClient', () => {
    process.env.SHOPSCOUT_LLM = 'mock';
    expect(makeLlm()).toBeInstanceOf(DevMockLlmClient);
  });

  it('api 모드 + 키 있으면 ApiLlmClient', () => {
    process.env.SHOPSCOUT_LLM = 'api';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(makeLlm()).toBeInstanceOf(ApiLlmClient);
  });

  it('api 모드 + 키 없으면 명확히 throw', () => {
    process.env.SHOPSCOUT_LLM = 'api';
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => makeLlm()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('미지정 + 키 있으면 api(서버 안전)', () => {
    delete process.env.SHOPSCOUT_LLM;
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(makeLlm()).toBeInstanceOf(ApiLlmClient);
  });

  it('미지정 + 키 없으면 agent-sdk', () => {
    delete process.env.SHOPSCOUT_LLM;
    delete process.env.ANTHROPIC_API_KEY;
    expect(makeLlm()).toBeInstanceOf(AgentSdkClient);
  });

  it('명시적 오타/미지원 값은 조용히 폴백하지 않고 throw', () => {
    process.env.SHOPSCOUT_LLM = 'API'; // 대문자 오타
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(() => makeLlm()).toThrow(/알 수 없는 SHOPSCOUT_LLM/);
  });
});
