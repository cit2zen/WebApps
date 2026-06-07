import Anthropic from '@anthropic-ai/sdk'
import type { SRSCardInput } from '../types'

const client = new Anthropic({ authToken: process.env.ANTHROPIC_AUTH_TOKEN })

export async function runSrsClassifier(
  question: string,
  summary: string
): Promise<SRSCardInput> {
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: '학습 내용을 과목/주제로 분류하고 Anki 스타일 플래시카드를 만드세요.',
    tools: [{
      name: 'classify_and_card',
      description: '과목 분류 + 플래시카드 생성',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: { type: 'string', description: '과목 (예: 물리, 수학, 생물, 화학, 역사)' },
          topic:    { type: 'string', description: '세부 주제 (예: 역학, 미적분, 세포분열)' },
          front:    { type: 'string', description: '카드 앞면 질문 (한국어)' },
          back:     { type: 'string', description: '카드 뒷면 답변 (한국어, 2~4문장)' },
        },
        required: ['category', 'topic', 'front', 'back'],
      },
    }],
    tool_choice: { type: 'tool', name: 'classify_and_card' },
    messages: [{ role: 'user', content: `질문: ${question}\n\n요약: ${summary}` }],
  })

  const block = resp.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    return { category: '기타', topic: '일반', front: question, back: summary }
  }
  return block.input as SRSCardInput
}
