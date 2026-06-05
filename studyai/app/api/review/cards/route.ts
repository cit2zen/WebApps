// app/api/review/cards/route.ts
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { SRSCard } from '@/lib/types'

export async function GET() {
  const cards = await query<SRSCard>(
    `SELECT * FROM srs_cards WHERE due_date <= CURRENT_DATE ORDER BY due_date LIMIT 20`
  )
  return NextResponse.json(cards)
}
