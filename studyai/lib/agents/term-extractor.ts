import Anthropic from '@anthropic-ai/sdk'
import type { Term } from '../types'

const client = new Anthropic({ authToken: process.env.ANTHROPIC_AUTH_TOKEN, apiKey: null })

export async function runTermExtractor(
  question: string,
  explanation: string
): Promise<Term[]> {
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: '설명에서 핵심 개념어를 3~6개 추출하고 간단히 정의하세요. 단어는 설명 본문에 실제로 등장하는 것만 선택하세요.',
    tools: [{
      name: 'extract_terms',
      description: '핵심 개념어와 정의 추출',
      input_schema: {
        type: 'object' as const,
        properties: {
          terms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word:       { type: 'string', description: '본문에 등장하는 정확한 단어' },
                definition: { type: 'string', description: '1~2문장 정의' },
                formula:    { type: 'string', description: '관련 LaTeX 수식 (선택)' },
              },
              required: ['word', 'definition'],
            },
          },
        },
        required: ['terms'],
      },
    }],
    tool_choice: { type: 'tool', name: 'extract_terms' },
    messages: [{ role: 'user', content: `질문: ${question}\n\n설명: ${explanation}` }],
  })

  const block = resp.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') return []
  return (block.input as { terms: Term[] }).terms ?? []
}
