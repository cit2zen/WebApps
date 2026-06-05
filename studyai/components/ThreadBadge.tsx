// components/ThreadBadge.tsx
'use client'
import { useEffect, useState } from 'react'
import type { Thread } from '@/lib/types'
import styles from './ThreadBadge.module.css'

interface Props {
  nodeId: string
  blockLabel: string
  onOpenThread: (nodeId: string, label: string) => void
}

export default function ThreadBadge({ nodeId, blockLabel, onOpenThread }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    fetch(`/api/threads-by-node?node_id=${nodeId}`)
      .then(r => r.json())
      .then(setThreads)
      .catch(() => {})
  }, [nodeId])

  if (threads.length === 0) return null

  return (
    <span className={styles.badge} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
      💬 {threads.length}
      {open && (
        <span className={styles.popup} onClick={e => e.stopPropagation()}>
          <span className={styles.popLabel}>이 블록의 추가 질문</span>
          {threads.map(t => (
            <button key={t.id} className={styles.popRow} onClick={() => { onOpenThread(nodeId, t.label); setOpen(false) }}>
              🔵 {t.label}
            </button>
          ))}
          <button className={styles.popAdd} onClick={() => { onOpenThread(nodeId, blockLabel); setOpen(false) }}>
            ＋ 새 추가 질문
          </button>
        </span>
      )}
    </span>
  )
}
