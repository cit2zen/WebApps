// components/BranchTree.tsx
'use client'
import type { TreeNode } from '@/lib/types'
import styles from './BranchTree.module.css'
import { useState } from 'react'

interface Props {
  tree: TreeNode[]
  onSelect: (nodeId: string) => void
  onClose: () => void
}

export default function BranchTree({ tree, onSelect, onClose }: Props) {
  const [colPath, setColPath] = useState<{ type: 'main' | 'thread'; id: string; nodes: TreeNode[] }[]>([
    { type: 'main', id: 'root', nodes: tree },
  ])
  const [selected, setSelected] = useState<string | null>(null)

  function drillMain(node: TreeNode) {
    setSelected(node.node.id)
    if (node.threads.length > 0) {
      setColPath(p => {
        const idx = p.findIndex(c => c.id === 'root')
        return [
          ...p.slice(0, idx + 1),
          {
            type: 'thread' as const,
            id: `threads-${node.node.id}`,
            nodes: node.threads.map(t => ({
              node: { ...node.node, question: t.thread.label, id: t.thread.id },
              threads: t.chain as unknown as import('@/lib/types').TreeThread[],
            })),
          },
        ]
      })
    }
  }

  function selectAndClose(nodeId: string) {
    onSelect(nodeId)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.top}>
          🌲 대화 트리
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.cols}>
          {colPath.map((col, ci) => (
            <div key={col.id} className={styles.col}>
              <div className={styles.colLabel}>{ci === 0 ? '메인 흐름' : '분기'}</div>
              {col.nodes.map(tn => (
                <button
                  key={tn.node.id}
                  className={`${styles.node} ${selected === tn.node.id ? styles.cur : ''}`}
                  onClick={() => drillMain(tn)}
                  onDoubleClick={() => selectAndClose(tn.node.id)}
                >
                  <span className={styles.q}>{tn.node.question.slice(0, 30)}{tn.node.question.length > 30 ? '…' : ''}</span>
                  {tn.threads.length > 0 && <span className={styles.arr}>›</span>}
                </button>
              ))}
            </div>
          ))}
          {selected && (
            <div className={styles.col} style={{ flex: 1 }}>
              <div className={styles.colLabel}>현재 위치</div>
              <p className={styles.preview}>
                {colPath[colPath.length - 1]?.nodes.find(n => n.node.id === selected)?.node.question}
              </p>
              <button className={styles.goBtn} onClick={() => selectAndClose(selected)}>이 위치로 이동 →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
