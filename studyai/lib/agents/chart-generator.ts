import Anthropic from '@anthropic-ai/sdk'
import type { ChartConfig } from '../types'

const client = new Anthropic()

export async function runChartGenerator(
  question: string,
  explanation: string
): Promise<ChartConfig[]> {
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: '개념을 시각화하는 Chart.js 설정을 생성하세요. 그래프가 불필요하면 빈 배열을 반환하세요. config는 완전한 Chart.js v4 설정 객체여야 합니다.',
    tools: [{
      name: 'generate_charts',
      description: 'Chart.js 설정 + 슬라이더 생성',
      input_schema: {
        type: 'object' as const,
        properties: {
          charts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                config: { type: 'object', description: 'Chart.js v4 config 객체' },
                sliders: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      variable: { type: 'string' },
                      min:      { type: 'number' },
                      max:      { type: 'number' },
                      step:     { type: 'number' },
                      default:  { type: 'number' },
                    },
                    required: ['variable', 'min', 'max', 'step', 'default'],
                  },
                },
              },
              required: ['config', 'sliders'],
            },
          },
        },
        required: ['charts'],
      },
    }],
    tool_choice: { type: 'tool', name: 'generate_charts' },
    messages: [{ role: 'user', content: `질문: ${question}\n\n설명: ${explanation}` }],
  })

  const block = resp.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') return []
  return (block.input as { charts: ChartConfig[] }).charts ?? []
}
