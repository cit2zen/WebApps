// components/SessionSidebar.tsx
'use client'
import type { Session } from '@/lib/types'
import styles from './SessionSidebar.module.css'

interface Props {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export default function SessionSidebar({ sessions, activeId, onSelect, onNew }: Props) {
  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return '오늘'
    if (diffDays === 1) return '어제'
    if (diffDays < 7) return `${diffDays}일 전`
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>학습 기록</div>
      <div className={styles.list}>
        {sessions.map(s => (
          <button
            key={s.id}
            className={`${styles.item} ${s.id === activeId ? styles.active : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <span className={styles.title}>{s.title}</span>
            <span className={styles.date}>{formatDate(s.created_at)}</span>
          </button>
        ))}
      </div>
      <button className={styles.newBtn} onClick={onNew}>＋ 새 주제 시작</button>
    </aside>
  )
}
