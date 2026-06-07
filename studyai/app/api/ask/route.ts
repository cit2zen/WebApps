// app/api/ask/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '@/lib/agents/orchestrator'
import { query }       from '@/lib/db'
import type { NodeRow, SRSCard } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  const { question, session_id, parent_id, thread_id } = await req.json()

  if (!question || !session_id) {
    return NextResponse.json({ error: 'question and session_id required' }, { status: 400 })
  }

  try {
    let context: string | undefined
    if (parent_id) {
      const parents = await query<NodeRow>(
        `WITH RECURSIVE chain AS (
          SELECT id, question, response, parent_id FROM nodes WHERE id = $1
          UNION ALL
          SELECT n.id, n.question, n.response, n.parent_id
          FROM nodes n JOIN chain c ON n.id = c.parent_id
        )
        SELECT * FROM chain LIMIT 3`,
        [parent_id]
      )
      context = parents.map(n => `Q: ${n.question}\nA: ${(n.response as any).intuitive}`).join('\n---\n')
    }

    const response = await orchestrate(question, context)

    const nodeId = uuidv4()
    await query(
      `INSERT INTO nodes (id, session_id, parent_id, thread_id, question, response)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nodeId, session_id, parent_id ?? null, thread_id ?? null, question, JSON.stringify(response)]
    )

    await query(
      `INSERT INTO srs_cards (node_id, front, back, category, topic)
       VALUES ($1, $2, $3, $4, $5)`,
      [nodeId, response.srs.front, response.srs.back, response.srs.category, response.srs.topic]
    )

    return NextResponse.json({ node_id: nodeId, response })
  } catch (err: any) {
    console.error('/api/ask error:', err)
    if (err?.status === 429) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'AI 응답 생성 실패' }, { status: 500 })
  }
}
