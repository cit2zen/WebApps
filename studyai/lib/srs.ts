// lib/srs.ts

export interface ReviewInput {
  interval: number;
  ease_factor: number;
}

export interface ReviewResult {
  interval: number;
  ease_factor: number;
  due_date: string;  // ISO date string "YYYY-MM-DD"
}

export function computeNextReview(card: ReviewInput, rating: 1 | 2 | 3 | 4): ReviewResult {
  let { interval, ease_factor } = card

  if (rating === 1) {
    interval = 1
    ease_factor = Math.max(1.3, ease_factor - 0.2)
  } else if (rating === 2) {
    interval = Math.round(interval * 1.3)
    ease_factor = Math.max(1.3, ease_factor - 0.15)
  } else if (rating === 3) {
    interval = Math.round(interval * ease_factor)
  } else {
    interval = Math.round(interval * ease_factor * 1.3)
    ease_factor = ease_factor + 0.15
  }

  interval = Math.max(1, interval)

  const due = new Date()
  due.setDate(due.getDate() + interval)
  const y = due.getFullYear()
  const m = String(due.getMonth() + 1).padStart(2, '0')
  const d = String(due.getDate()).padStart(2, '0')
  const due_date = `${y}-${m}-${d}`

  return { interval, ease_factor, due_date }
}
