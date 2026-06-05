import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function runExplainer(
  question: string,
  context?: string
): Promise<{ intuitive: string; detailed: string }> {
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: '당신은 한국어로 개념을 설명하는 학습 도우미입니다. 직관적 요약은 비유와 일상 언어로, 상세 설명은 기술적으로 작성하세요. 마크다운을 사용해도 됩니다.',
    tools: [{
      name: 'provide_explanation',
      description: '개념에 대한 구조화된 설명 제공',
      input_schema: {
        type: 'object' as const,
        properties: {
          intuitive: { type: 'string', description: '비유·직관 설명 (한국어 마크다운)' },
          detailed:  { type: 'string', description: '기술적 상세 설명 (한국어 마크다운)' },
        },
        required: ['intuitive', 'detailed'],
      },
    }],
    tool_choice: { type: 'tool', name: 'provide_explanation' },
    messages: [{ role: 'user', content: context ? `맥락: ${context}\n\n질문: ${question}` : question }],
  })

  const block = resp.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('explainer: no tool_use')
  return block.input as { intuitive: string; detailed: string }
}
