// app/api/sessions/[id]/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { NodeRow } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nodes = await query<NodeRow>(`SELECT * FROM nodes WHERE session_id = $1 ORDER BY created_at`, [id])
  return NextResponse.json(nodes)
}
