// app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Session } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { title } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const id = uuidv4()
  await query(`INSERT INTO sessions (id, title) VALUES ($1, $2)`, [id, title])
  const [session] = await query<Session>(`SELECT * FROM sessions WHERE id = $1`, [id])
  return NextResponse.json(session)
}
