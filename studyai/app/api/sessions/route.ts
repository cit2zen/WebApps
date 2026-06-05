// app/api/sessions/route.ts
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { Session } from '@/lib/types'

export async function GET() {
  const sessions = await query<Session>(
    `SELECT * FROM sessions ORDER BY created_at DESC`
  )
  return NextResponse.json(sessions)
}
