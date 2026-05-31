// lib/agent.ts
import {
  query,
  createSdkMcpServer,
  type CanUseTool,
  type PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { timeTool } from "./tools/time";
import { memoryTool } from "./tools/memory";
import { SYSTEM_PROMPT } from "./persona";

const MODEL = process.env.JARVIS_MODEL || "sonnet"; // 'sonnet'=저지연, 'opus'=고품질

// 이 에이전트가 사용할 수 있는 도구의 유일한 출처(single source of truth).
// WebSearch + 앱 MCP 2종 + 서브에이전트 디스패치(Agent)만 허용한다.
const ALLOWED_TOOLS = new Set([
  "WebSearch",
  "mcp__app__now",
  "mcp__app__memory",
  "Agent", // 서브에이전트(researcher) 디스패치
]);

const appServer = createSdkMcpServer({
  name: "app",
  version: "1.0.0",
  tools: [timeTool, memoryTool],
});

// 비대화형 권한 게이트: 허용 목록에 있으면 그대로 통과, 그 외엔 결정적으로 거부한다.
// 사람에게 묻지 않으므로(서버 환경) 절대 멈추지 않는다.
export const canUseTool: CanUseTool = async (toolName, input): Promise<PermissionResult> => {
  if (ALLOWED_TOOLS.has(toolName)) {
    return { behavior: "allow", updatedInput: input };
  }
  return {
    behavior: "deny",
    message: `도구 '${toolName}'는 JARVIS에서 허용되지 않습니다.`,
  };
};

// 한 턴을 실행하고 SDK 메시지 제너레이터를 반환한다.
// sessionId가 있으면 이전 대화를 resume한다.
export function runJarvis(message: string, sessionId: string | undefined, signal: AbortSignal) {
  // 구독(OAuth) 인증을 강제: API 키가 있으면 그게 우선 청구되므로 제거.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  const abortController = new AbortController();
  if (signal.aborted) abortController.abort();
  else signal.addEventListener("abort", () => abortController.abort(), { once: true });

  return query({
    prompt: message,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      includePartialMessages: true, // 토큰 델타 스트리밍
      permissionMode: "default", // bypass 비활성화: canUseTool 게이트로 도구 제한
      canUseTool, // 허용 목록 외 도구는 결정적으로 거부(사람 개입 없음)
      abortController,
      ...(sessionId ? { resume: sessionId } : {}),
      mcpServers: { app: appServer },
      allowedTools: [...ALLOWED_TOOLS],
      maxTurns: 12,
      agents: {
        researcher: {
          description:
            "특정 주제를 한 측면에서 깊게 조사하는 리서치 전문가. 폭넓은 조사 시 여러 명을 병렬로 띄워 각자 다른 측면을 맡긴다.",
          prompt:
            "당신은 리서치 전문가입니다. 배정된 한 가지 측면을 WebSearch로 조사하고, 핵심 사실만 간결한 한국어로 요약해 반환하세요. 출처 URL을 함께 적습니다.",
          tools: ["WebSearch"],
          model: "sonnet",
        },
      },
    },
  });
}
