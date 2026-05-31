import type { NextConfig } from 'next';

const config: NextConfig = {
  // Docker 배포용 standalone 산출물(.next/standalone/server.js)
  output: 'standalone',
  // better-sqlite3는 동적 import(서버 전용)이며 SHOPSCOUT_STORE=memory에선 미사용.
  // 번들에 끌어들이지 않도록 외부 처리(미설치 시에도 빌드 무해).
  serverExternalPackages: ['better-sqlite3'],
};

export default config;
