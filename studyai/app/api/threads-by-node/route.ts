// app/api/threads-by-node/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { Thread } from '@/lib/types'

export async function GET(req: NextRequest) {
  const nodeId = req.nextUrl.searchParams.get('node_id')
  if (!nodeId) return NextResponse.json([])
  const threads = await query<Thread>(`SELECT * FROM threads WHERE parent_node_id = $1 ORDER BY created_at`, [nodeId])
  return NextResponse.json(threads)
}
