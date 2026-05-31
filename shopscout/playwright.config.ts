import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
    // 자격증명 없이 결정적으로 구동 (Windows에서도 동작하도록 env 필드 사용)
    env: { SHOPSCOUT_LLM: 'mock', SHOPSCOUT_SOURCES: 'mock', SHOPSCOUT_STORE: 'memory' },
  },
});
