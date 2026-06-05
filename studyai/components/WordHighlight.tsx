// components/WordHighlight.tsx
'use client'
import styles from './WordHighlight.module.css'
import type { Term } from '@/lib/types'

interface Props {
  term: Term
  onOpenThread?: (word: string) => void
}

export default function WordHighlight({ term, onOpenThread }: Props) {
  return (
    <span className={styles.word}>
      {term.word}
      <span className={styles.tooltip}>
        <strong>{term.word}</strong>
        <p>{term.definition}</p>
        {term.formula && <code className={styles.formula}>{term.formula}</code>}
        {onOpenThread && (
          <button className={styles.more} onClick={() => onOpenThread(term.word)}>
            ▶ 추가 질문으로 자세히
          </button>
        )}
      </span>
    </span>
  )
}
