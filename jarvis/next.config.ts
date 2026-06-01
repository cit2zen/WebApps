import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Agent SDK·msedge-tts는 서브프로세스/소켓을 쓰므로 번들러가 건드리면 안 됨
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "msedge-tts"],
  // /api/tts가 spawn하는 워커 스크립트를 standalone 출력에 포함(트레이싱 누락 방지)
  outputFileTracingIncludes: {
    "/api/tts": ["./lib/tts-worker.mjs"],
  },
  // three의 JSM addon ESM 상호운용 이슈 예방 (무해)
  transpilePackages: ["three"],
};

export default nextConfig;
