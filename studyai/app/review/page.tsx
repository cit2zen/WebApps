// app/review/page.tsx
'use client'
import { useState, useEffect } from 'react'
import type { SRSCard } from '@/lib/types'
import styles from './page.module.css'
import Link from 'next/link'

export default function ReviewPage() {
  const [cards, setCards]     = useState<SRSCard[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    fetch('/api/review/cards').then(r => r.json()).then((c: SRSCard[]) => {
      setCards(c)
      if (c.length === 0) setDone(true)
    })
  }, [])

  async function rate(rating: 1 | 2 | 3 | 4) {
    const card = cards[current]
    await fetch('/api/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, rating }),
    })
    if (current + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrent(c => c + 1)
      setFlipped(false)
    }
  }

  if (done) return (
    <div className={styles.center}>
      <div className={styles.doneMsg}>✅ 오늘의 복습 완료!</div>
      <Link href="/" className={styles.backBtn}>← 학습으로 돌아가기</Link>
    </div>
  )

  if (cards.length === 0) return (
    <div className={styles.center}>
      <p className={styles.muted}>복습할 카드가 없습니다.</p>
      <Link href="/" className={styles.backBtn}>← 돌아가기</Link>
    </div>
  )

  const card = cards[current]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← StudyAI</Link>
        <span className={styles.progress}>{current + 1} / {cards.length}</span>
        <span className={styles.tag}>{card.category} › {card.topic}</span>
      </header>

      <div className={styles.cardWrap}>
        <div className={`${styles.card} ${flipped ? styles.flipped : ''}`} onClick={() => setFlipped(true)}>
          <div className={styles.front}>
            <p className={styles.label}>질문</p>
            <p className={styles.text}>{card.front}</p>
            {!flipped && <p className={styles.hint}>클릭해서 답 확인</p>}
          </div>
          {flipped && (
            <div className={styles.back}>
              <p className={styles.label}>답변</p>
              <p className={styles.text}>{card.back}</p>
            </div>
          )}
        </div>

        {flipped && (
          <div className={styles.ratings}>
            <button className={styles.r1} onClick={() => rate(1)}>1 다시</button>
            <button className={styles.r2} onClick={() => rate(2)}>2 어렵</button>
            <button className={styles.r3} onClick={() => rate(3)}>3 보통</button>
            <button className={styles.r4} onClick={() => rate(4)}>4 쉬움</button>
          </div>
        )}
      </div>
    </div>
  )
}
