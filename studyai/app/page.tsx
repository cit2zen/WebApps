// app/page.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import type { Session, NodeRow, StructuredResponse, TreeNode } from '@/lib/types'
import SessionSidebar from '@/components/SessionSidebar'
import ResponseBlock  from '@/components/ResponseBlock'
import FollowUpPanel  from '@/components/FollowUpPanel'
import BranchTree     from '@/components/BranchTree'
import styles from './page.module.css'

export default function Home() {
  const [sessions, setSessions]         = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [nodes, setNodes]               = useState<NodeRow[]>([])
  const [tree, setTree]                 = useState<TreeNode[]>([])
  const [question, setQuestion]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [activeThreadLabel, setActiveThreadLabel] = useState('추가 질문')
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [showTree, setShowTree]         = useState(false)
  const [deepView, setDeepView]         = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/sessions').then(r => r.json()).then((s: Session[]) => {
      setSessions(s)
      if (s.length > 0) loadSession(s[0])
    })
  }, [])

  async function loadSession(s: Session) {
    setActiveSession(s)
    const nodeData = await fetch(`/api/sessions/${s.id}/nodes`).then(r => r.json()) as NodeRow[]
    const treeData = await fetch(`/api/session/${s.id}/tree`).then(r => r.json()) as TreeNode[]
    setNodes(nodeData)
    setTree(treeData)
    setFocusedNodeId(null)
  }

  async function createSession(title: string) {
    const s = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(r => r.json()) as Session
    setSessions(prev => [s, ...prev])
    setActiveSession(s)
    setNodes([])
    setTree([])
  }

  async function handleNewSession() {
    const title = prompt('새 주제 이름을 입력하세요:')
    if (title?.trim()) await createSession(title.trim())
  }

  async function submitQuestion() {
    if (!question.trim() || !activeSession || loading) return
    setLoading(true)

    try {
      const lastMainNode = nodes.filter(n => !n.thread_id).slice(-1)[0]

      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          session_id: activeSession.id,
          parent_id: lastMainNode?.id ?? null,
        }),
      })
      const data = await r.json() as { node_id: string; response: StructuredResponse }

      const newNode: NodeRow = {
        id: data.node_id,
        session_id: activeSession.id,
        parent_id: lastMainNode?.id ?? null,
        thread_id: null,
        question,
        response: data.response,
        created_at: new Date().toISOString(),
      }
      setNodes(prev => [...prev, newNode])
      setQuestion('')

      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenThread(nodeId: string, label: string) {
    setFocusedNodeId(nodeId)
    setActiveThreadLabel(label)
  }

  const mainNodes = nodes.filter(n => n.thread_id === null)
  const currentNode = focusedNodeId ? nodes.find(n => n.id === focusedNodeId) : null

  return (
    <div className={styles.app}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <span className={styles.logo}>🧠 StudyAI</span>
        <div className={styles.viewToggle}>
          <button className={`${styles.toggleBtn} ${!deepView ? styles.toggleActive : ''}`} onClick={() => setDeepView(false)}>
            📖 답변 보기
          </button>
          <button className={`${styles.toggleBtn} ${deepView ? styles.toggleActive : ''}`} onClick={() => { setDeepView(true); setPanelExpanded(true) }}>
            💬 추가 질문 전체 보기
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Left sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeId={activeSession?.id ?? null}
          onSelect={id => { const s = sessions.find(s => s.id === id); if (s) loadSession(s) }}
          onNew={handleNewSession}
        />

        {/* Center: response blocks */}
        {!deepView && (
          <main className={styles.content}>
            {/* Breadcrumb */}
            <div className={styles.breadcrumb}>
              {activeSession && <span onClick={() => setFocusedNodeId(null)}>{activeSession.title}</span>}
              {currentNode && (
                <>
                  <span className={styles.sep}>›</span>
                  <span className={styles.curCrumb}>{currentNode.question.slice(0, 30)}</span>
                </>
              )}
              <button className={styles.treeBtn} onClick={() => setShowTree(true)}>🌲 트리 보기</button>
            </div>

            <div className={styles.scroll} ref={scrollRef}>
              {!activeSession && <p className={styles.hint}>왼쪽에서 주제를 선택하거나 새 주제를 시작하세요.</p>}
              {mainNodes.map(node => (
                <div key={node.id}>
                  <div className={styles.qLabel}>Q: {node.question}</div>
                  <ResponseBlock
                    nodeId={node.id}
                    response={node.response}
                    focusedNodeId={focusedNodeId}
                    onFocus={setFocusedNodeId}
                    onOpenThread={handleOpenThread}
                    onWordThread={word => { if (focusedNodeId) handleOpenThread(focusedNodeId, word) }}
                    onDragSelect={text => setQuestion(prev => prev ? `${prev} "${text}"` : `"${text}"에 대해 설명해줘`)}
                  />
                </div>
              ))}
              {loading && <div className={styles.thinkingMsg}>🤔 생각 중...</div>}
            </div>

            <div className={styles.inputArea}>
              <div className={styles.inputWrap}>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitQuestion()}
                  placeholder={activeSession ? '💬 새 질문 입력, 또는 텍스트를 드래그하면 자동으로 채워집니다...' : '먼저 주제를 선택하세요'}
                  disabled={!activeSession || loading}
                  className={styles.input}
                />
                <button onClick={submitQuestion} disabled={!activeSession || loading} className={styles.sendBtn}>
                  {loading ? '...' : '전송'}
                </button>
              </div>
            </div>
          </main>
        )}

        {/* Right: follow-up panel */}
        {activeSession && (
          <FollowUpPanel
            activeNodeId={focusedNodeId}
            activeThreadLabel={activeThreadLabel}
            sessionId={activeSession.id}
            onExpand={exp => { setPanelExpanded(exp); if (!exp) setDeepView(false) }}
          />
        )}
      </div>

      {/* Tree overlay */}
      {showTree && <BranchTree tree={tree} onSelect={id => setFocusedNodeId(id)} onClose={() => setShowTree(false)} />}
    </div>
  )
}
