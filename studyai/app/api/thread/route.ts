// app/api/thread/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Thread } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { parent_node_id, label } = await req.json()
  if (!parent_node_id || !label) {
    return NextResponse.json({ error: 'parent_node_id and label required' }, { status: 400 })
  }
  try {
    // Check for existing thread with same parent and label
    const existing = await query<Thread>(
      `SELECT * FROM threads WHERE parent_node_id = $1 AND label = $2 LIMIT 1`,
      [parent_node_id, label]
    )
    if (existing.length > 0) {
      return NextResponse.json(existing[0])
    }

    const id = uuidv4()
    await query(`INSERT INTO threads (id, parent_node_id, label) VALUES ($1, $2, $3)`, [id, parent_node_id, label])
    const [thread] = await query<Thread>(`SELECT * FROM threads WHERE id = $1`, [id])
    return NextResponse.json(thread)
  } catch (err) {
    console.error('/api/thread error:', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
