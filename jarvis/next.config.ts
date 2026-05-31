import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Agent SDK는 서브프로세스(cli.js)를 spawn하므로 번들러가 건드리면 안 됨
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  // three의 JSM addon ESM 상호운용 이슈 예방 (무해)
  transpilePackages: ["three"],
};

export default nextConfig;
