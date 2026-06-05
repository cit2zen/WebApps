// components/FollowUpPanel.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import type { Thread } from '@/lib/types'
import styles from './FollowUpPanel.module.css'

interface TurnNode {
  question: string
  answer: string
  node_id: string
  depth: number
  children: TurnNode[]
}

interface Props {
  activeNodeId: string | null
  activeThreadLabel: string
  sessionId: string
  onExpand: (expanded: boolean) => void
}

export default function FollowUpPanel({ activeNodeId, activeThreadLabel, sessionId, onExpand }: Props) {
  const [input, setInput]     = useState('')
  const [turns, setTurns]     = useState<TurnNode[]>([])
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [parentNodeId, setParentNodeId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTurns([])
    setThreadId(null)
    setParentNodeId(activeNodeId)
  }, [activeNodeId, activeThreadLabel])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  async function submit() {
    if (!input.trim() || !activeNodeId || loading) return
    setLoading(true)

    try {
      let tid = threadId
      if (!tid) {
        const r = await fetch('/api/thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_node_id: activeNodeId, label: activeThreadLabel }),
        })
        const thread = await r.json() as Thread
        tid = thread.id
        setThreadId(tid)
      }

      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          session_id: sessionId,
          parent_id: parentNodeId ?? activeNodeId,
          thread_id: tid,
        }),
      })
      const data = await r.json() as { node_id: string; response: { intuitive: string; srs: { category: string; topic: string } } }

      setTurns(t => [...t, {
        question: input,
        answer: data.response.intuitive,
        node_id: data.node_id,
        depth: 0,
        children: [],
      }])
      setParentNodeId(data.node_id)
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  function handleExpand() {
    const next = !expanded
    setExpanded(next)
    onExpand(next)
  }

  return (
    <aside className={`${styles.panel} ${expanded ? styles.wide : ''}`}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>💬 추가 질문</div>
        </div>
        <div className={styles.headerRight}>
          {activeNodeId && <span className={styles.origin}>{activeThreadLabel}</span>}
          <button className={styles.expandBtn} onClick={handleExpand}>{expanded ? '⤡' : '⤢'}</button>
        </div>
      </div>

      <div className={styles.scroll} ref={scrollRef}>
        {turns.length === 0 && activeNodeId && (
          <p className={styles.empty}>블록을 클릭한 후 추가 질문을 입력하세요.</p>
        )}
        {turns.length === 0 && !activeNodeId && (
          <p className={styles.empty}>답변 블록을 클릭하면 추가 질문을 할 수 있습니다.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={styles.turn}>
            <div className={styles.q}>
              <div className={styles.who}>나</div>
              <div className={styles.bubble}>{t.question}</div>
            </div>
            <div className={styles.a}>
              <div className={`${styles.who} ${styles.aiWho}`}>AI</div>
              <div className={`${styles.bubble} ${styles.aiBubble}`}>{t.answer}</div>
              <button className={styles.digBtn} onClick={() => setParentNodeId(t.node_id)}>
                ↩ 이 답변에 더 물어보기
              </button>
            </div>
          </div>
        ))}
        {loading && <div className={styles.loading}>생각 중...</div>}
      </div>

      <div className={styles.inputWrap}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
          placeholder={activeNodeId ? '↩ 계속 추가 질문...' : '답변 블록을 클릭한 후 질문하세요'}
          disabled={!activeNodeId || loading}
          className={styles.input}
        />
        <button onClick={submit} disabled={!activeNodeId || loading} className={styles.sendBtn}>↑</button>
      </div>
    </aside>
  )
}
