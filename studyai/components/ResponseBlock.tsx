'use client'
import 'katex/dist/katex.min.css'
import { BlockMath } from 'react-katex'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { StructuredResponse, Term } from '@/lib/types'
import VariableChip from './VariableChip'
import WordHighlight from './WordHighlight'
import SliderChart   from './SliderChart'
import ThreadBadge   from './ThreadBadge'
import styles from './ResponseBlock.module.css'

interface Props {
  nodeId: string
  response: StructuredResponse
  focusedNodeId: string | null
  onFocus: (nodeId: string) => void
  onOpenThread: (nodeId: string, label: string) => void
  onWordThread: (word: string) => void
  onDragSelect: (text: string) => void
}

function highlightTerms(text: string, terms: Term[], onOpenThread: (w: string) => void): React.ReactNode[] {
  if (!terms.length) return [text]
  const pattern = new RegExp(`(${terms.map(t => t.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const parts = text.split(pattern)
  return parts.map((part, i) => {
    const term = terms.find(t => t.word === part)
    if (term) return <WordHighlight key={i} term={term} onOpenThread={onOpenThread} />
    return part
  })
}

export default function ResponseBlock({ nodeId, response, focusedNodeId, onFocus, onOpenThread, onWordThread, onDragSelect }: Props) {
  const isFocused = focusedNodeId === nodeId

  function handleMouseUp() {
    const sel = window.getSelection()?.toString().trim()
    if (sel) onDragSelect(sel)
  }

  function handleBlockClick(label: string) {
    onFocus(nodeId)
    onOpenThread(nodeId, label)
  }

  return (
    <div className={styles.wrap} onMouseUp={handleMouseUp}>

      {/* 직관 요약 */}
      <div
        className={`${styles.block} ${styles.intuitive} ${isFocused ? styles.focused : ''}`}
        onClick={() => handleBlockClick('직관 요약')}
      >
        <div className={styles.label}>📊 직관 요약</div>
        <div className={styles.body}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p>{highlightTerms(String(children), response.terms, onWordThread)}</p>,
            }}
          >
            {response.intuitive}
          </ReactMarkdown>
        </div>
        <ThreadBadge nodeId={nodeId} blockLabel="직관 요약" onOpenThread={onOpenThread} />
      </div>

      {/* 수식 */}
      {response.formulas.length > 0 && (
        <div
          className={`${styles.block} ${styles.formula} ${isFocused ? styles.focused : ''}`}
          onClick={() => handleBlockClick('수식')}
        >
          <div className={styles.label}>🔢 수식</div>
          {response.formulas.map((f, i) => (
            <div key={i} className={styles.formulaBlock}>
              <BlockMath math={f.latex} />
              <div className={styles.vars}>
                {f.variables.map((v, j) => (
                  <VariableChip key={j} variable={v} />
                ))}
              </div>
            </div>
          ))}
          <ThreadBadge nodeId={nodeId} blockLabel="수식" onOpenThread={onOpenThread} />
        </div>
      )}

      {/* 그래프 */}
      {response.charts.length > 0 && (
        <div
          className={`${styles.block} ${styles.chart} ${isFocused ? styles.focused : ''}`}
          onClick={() => handleBlockClick('그래프')}
        >
          <div className={styles.label}>📈 그래프</div>
          {response.charts.map((c, i) => <SliderChart key={i} chartConfig={c} />)}
          <ThreadBadge nodeId={nodeId} blockLabel="그래프" onOpenThread={onOpenThread} />
        </div>
      )}

      {/* 상세 설명 */}
      <div
        className={`${styles.block} ${styles.detailed} ${isFocused ? styles.focused : ''}`}
        onClick={() => handleBlockClick('상세 설명')}
      >
        <div className={styles.label}>📖 상세 설명</div>
        <div className={styles.body}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {response.detailed}
          </ReactMarkdown>
        </div>
        <ThreadBadge nodeId={nodeId} blockLabel="상세 설명" onOpenThread={onOpenThread} />
      </div>

    </div>
  )
}
