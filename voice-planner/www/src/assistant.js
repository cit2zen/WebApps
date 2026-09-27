import { getSettings } from './settings.js';
import { TOOLS, executeTool } from './assistant-tools.js';

const MODEL = 'claude-opus-5';
const MAX_ITERATIONS = 8;
const MAX_EXCHANGES = 6;

const SYSTEM_PROMPT = `당신은 "보이스 플래너" 음성 비서입니다. 사용자는 번호가 매겨진 할 일 목록(Google Tasks)과 Google 캘린더를 음성으로 관리합니다.
- 할 일은 항상 미완료 항목의 1부터 시작하는 순번으로 지칭됩니다. 순번으로 수정/삭제/완료하기 전에 그 순번이 맞는지 애매하면 list_todos로 먼저 확인하세요.
- "내일 오후 3시", "다음 주 월요일" 같은 한국어 상대 날짜/시간은 매 사용자 턴 시작에 주어지는 현재 시각과 요일, 타임존을 기준으로 해석하세요.
- 일정 삭제나 수정 대상이 여러 개일 수 있어 애매하면 추측하지 말고 짧게 되물으세요.
- 답변은 TTS로 바로 읽히므로 마크다운, 이모지, 기호 없이 1~2문장의 짧은 구어체 한국어로 답하세요.
- 사용자가 목록을 들려달라고 한 경우에만 "1번 우유 사기, 2번 병원 예약" 처럼 최대 7개까지 번호와 함께 읽어주세요. 그 외에는 목록 형태로 나열하지 마세요.`;

const STATUS_BY_TOOL = {
  list_todos: '할 일 목록 확인 중…',
  add_todo: '할 일 추가 중…',
  complete_todo: '할 일 완료 처리 중…',
  reopen_todo: '할 일 되돌리는 중…',
  delete_todo: '할 일 삭제 중…',
  rename_todo: '할 일 이름 바꾸는 중…',
  move_todo: '할 일 순서 바꾸는 중…',
  list_events: '일정 확인 중…',
  create_event: '일정 추가 중…',
  update_event: '일정 수정 중…',
  delete_event: '일정 삭제 중…',
};

let client = null;
let clientKey = null;
let exchanges = [];

async function getClient() {
  const { anthropicKey } = await getSettings();
  if (!anthropicKey) throw new Error('NO_API_KEY');
  if (!client || clientKey !== anthropicKey) {
    const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk@0.128.0');
    client = new Anthropic({ apiKey: anthropicKey, dangerouslyAllowBrowser: true });
    clientKey = anthropicKey;
  }
  return client;
}

function nowPreamble() {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = now.toLocaleDateString('ko-KR', { weekday: 'long' });
  const local = now.toLocaleString('ko-KR');
  return `현재 시각: ${local} (${weekday}), 타임존: ${tz}`;
}

function flatten() {
  const messages = [];
  for (const exchange of exchanges) messages.push(...exchange);
  return messages;
}

function trimExchanges() {
  while (exchanges.length > MAX_EXCHANGES) exchanges.shift();
}

function collectText(content) {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
}

async function runToolUses(toolUses, changed, onStatus) {
  const statuses = new Set(toolUses.map((b) => STATUS_BY_TOOL[b.name] || '작업 처리 중…'));
  if (onStatus) onStatus([...statuses].join(' '));
  const results = [];
  for (const block of toolUses) {
    try {
      const output = await executeTool(block.name, block.input, changed);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
    } catch (err) {
      if (err?.message === 'NOT_SIGNED_IN') throw err;
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: err && err.message ? err.message : String(err),
        is_error: true,
      });
    }
  }
  return results;
}

export async function runCommand(text, { onStatus } = {}) {
  const anthropic = await getClient();
  const changed = { todos: false, events: false };
  const current = [
    {
      role: 'user',
      content: [
        { type: 'text', text: nowPreamble() },
        { type: 'text', text },
      ],
    },
  ];

  let reply = '';
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (onStatus) onStatus('생각 중…');
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      messages: [...flatten(), ...current],
    });

    current.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') {
      reply = '죄송하지만 그 요청은 도와드릴 수 없어요.';
      break;
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason === 'tool_use' && toolUses.length > 0) {
      const results = await runToolUses(toolUses, changed, onStatus);
      current.push({ role: 'user', content: results });
      continue;
    }

    if (response.stop_reason === 'pause_turn') continue;

    reply = collectText(response.content);
    break;
  }

  const last = current[current.length - 1];
  const lastHasToolUse = last?.role === 'assistant' && Array.isArray(last.content) &&
    last.content.some((b) => b.type === 'tool_use');
  if (!lastHasToolUse) {
    exchanges.push(current);
    trimExchanges();
  }

  return { reply: reply || '완료했어요.', changed };
}

export function resetConversation() {
  exchanges = [];
}
