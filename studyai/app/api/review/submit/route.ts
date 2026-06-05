// app/api/review/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { computeNextReview } from '@/lib/srs'
import type { SRSCard } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  const { card_id, rating } = await req.json()
  if (!card_id || ![1,2,3,4].includes(rating)) {
    return NextResponse.json({ error: 'card_id and rating(1-4) required' }, { status: 400 })
  }

  const [card] = await query<SRSCard>(`SELECT * FROM srs_cards WHERE id = $1`, [card_id])
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  const next = computeNextReview({ interval: card.interval, ease_factor: card.ease_factor }, rating as 1|2|3|4)

  await query(
    `UPDATE srs_cards SET interval = $1, ease_factor = $2, due_date = $3 WHERE id = $4`,
    [next.interval, next.ease_factor, next.due_date, card_id]
  )
  await query(
    `INSERT INTO srs_reviews (id, card_id, rating) VALUES ($1, $2, $3)`,
    [uuidv4(), card_id, rating]
  )

  return NextResponse.json({ next })
}
