// components/VariableChip.tsx
'use client'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'
import type { Variable } from '@/lib/types'
import styles from './VariableChip.module.css'
import tip from './Tooltip.module.css'

interface Props {
  variable: Variable
  colorClass?: string
}

export default function VariableChip({ variable, colorClass }: Props) {
  return (
    <span className={`${tip.host} ${styles.chip} ${colorClass ?? ''}`}>
      <InlineMath math={variable.symbol} />
      <span className={`${tip.tip} ${tip.passive}`}>
        <strong>{variable.symbol} — {variable.name}</strong>
        {variable.unit && <span className={styles.unit}> ({variable.unit})</span>}
        <span className={tip.body}>{variable.definition}</span>
      </span>
    </span>
  )
}
