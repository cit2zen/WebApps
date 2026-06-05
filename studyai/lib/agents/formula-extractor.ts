import Anthropic from '@anthropic-ai/sdk'
import type { Formula } from '../types'

const client = new Anthropic()

export async function runFormulaExtractor(
  question: string,
  explanation: string
): Promise<Formula[]> {
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: '수식을 LaTeX으로 추출하고 각 변수를 정의하세요. 수식이 없으면 빈 배열을 반환하세요.',
    tools: [{
      name: 'extract_formulas',
      description: '수식과 변수 정의 추출',
      input_schema: {
        type: 'object' as const,
        properties: {
          formulas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                latex:     { type: 'string', description: 'LaTeX 수식 (예: E = \\\\frac{1}{2}kA^2)' },
                variables: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      symbol:     { type: 'string' },
                      name:       { type: 'string' },
                      unit:       { type: 'string' },
                      definition: { type: 'string' },
                    },
                    required: ['symbol', 'name', 'unit', 'definition'],
                  },
                },
              },
              required: ['latex', 'variables'],
            },
          },
        },
        required: ['formulas'],
      },
    }],
    tool_choice: { type: 'tool', name: 'extract_formulas' },
    messages: [{ role: 'user', content: `질문: ${question}\n\n설명: ${explanation}` }],
  })

  const block = resp.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') return []
  return (block.input as { formulas: Formula[] }).formulas ?? []
}
