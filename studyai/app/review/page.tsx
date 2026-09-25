// app/review/page.tsx
'use client'
import { useState, useEffect } from 'react'
import type { SRSCard } from '@/lib/types'
import styles from './page.module.css'
import Link from 'next/link'

function ReviewBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="pol-appbar">
      <a className="pol-brand" href="https://cityzen.kr">cityzen</a>
      <span className="pol-appbar-sep" aria-hidden="true" />
      <Link href="/" className={`pol-appbar-title ${styles.appLink}`}>StudyAI</Link>
      <span className="pol-badge">복습</span>
      <div className="pol-appbar-end">{children}</div>
    </header>
  )
}

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
    <div className={styles.page}>
      <ReviewBar />
      <main className={styles.center}>
        <div className={styles.note}>
          <div className={styles.doneMsg}>✅ 오늘의 복습 완료!</div>
          <Link href="/" className="pol-btn-primary">← 학습으로 돌아가기</Link>
        </div>
      </main>
    </div>
  )

  if (cards.length === 0) return (
    <div className={styles.page}>
      <ReviewBar />
      <main className={styles.center}>
        <div className={styles.note}>
          <p className={styles.muted}>복습할 카드가 없습니다.</p>
          <Link href="/" className="pol-btn-ghost">← 돌아가기</Link>
        </div>
      </main>
    </div>
  )

  const card = cards[current]

  return (
    <div className={styles.page}>
      <ReviewBar>
        <span className={styles.progress}>{current + 1} / {cards.length}</span>
      </ReviewBar>

      <main className={styles.cardWrap}>
        <div className={styles.meta}>
          <span className={`pol-badge ${styles.tag}`}>{card.category} › {card.topic}</span>
        </div>
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
            <button className={`pol-btn-ghost ${styles.rate} ${styles.r1}`} onClick={() => rate(1)}>1 다시</button>
            <button className={`pol-btn-ghost ${styles.rate} ${styles.r2}`} onClick={() => rate(2)}>2 어렵</button>
            <button className={`pol-btn-ghost ${styles.rate} ${styles.r3}`} onClick={() => rate(3)}>3 보통</button>
            <button className={`pol-btn-ghost ${styles.rate} ${styles.r4}`} onClick={() => rate(4)}>4 쉬움</button>
          </div>
        )}
      </main>
    </div>
  )
}
