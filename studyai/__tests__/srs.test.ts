// __tests__/srs.test.ts
import { describe, it, expect } from 'vitest'
import { computeNextReview } from '../lib/srs'

describe('computeNextReview', () => {
  it('rating 1(again): interval resets to 1, ease drops', () => {
    const result = computeNextReview({ interval: 6, ease_factor: 2.5 }, 1)
    expect(result.interval).toBe(1)
    expect(result.ease_factor).toBeCloseTo(2.3, 1)
  })

  it('rating 2(hard): interval increases modestly, ease drops slightly', () => {
    const result = computeNextReview({ interval: 6, ease_factor: 2.5 }, 2)
    expect(result.interval).toBe(8)   // round(6 * 1.3)
    expect(result.ease_factor).toBeCloseTo(2.35, 1)
  })

  it('rating 3(good): interval multiplied by ease', () => {
    const result = computeNextReview({ interval: 6, ease_factor: 2.5 }, 3)
    expect(result.interval).toBe(15)  // round(6 * 2.5)
    expect(result.ease_factor).toBeCloseTo(2.5, 1)
  })

  it('rating 4(easy): interval multiplied by ease * 1.3, ease increases', () => {
    const result = computeNextReview({ interval: 6, ease_factor: 2.5 }, 4)
    expect(result.interval).toBe(20)  // round(6 * 2.5 * 1.3)
    expect(result.ease_factor).toBeCloseTo(2.65, 1)
  })

  it('ease_factor never drops below 1.3', () => {
    const result = computeNextReview({ interval: 1, ease_factor: 1.3 }, 1)
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('due_date is today + interval days', () => {
    const result = computeNextReview({ interval: 1, ease_factor: 2.5 }, 3)
    const today = new Date()
    const due = new Date(result.due_date)
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
    expect(diffDays).toBe(result.interval)
  })
})
