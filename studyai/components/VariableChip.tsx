// components/VariableChip.tsx
'use client'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'
import type { Variable } from '@/lib/types'
import styles from './VariableChip.module.css'

interface Props {
  variable: Variable
  colorClass?: string
}

export default function VariableChip({ variable, colorClass }: Props) {
  return (
    <span className={`${styles.chip} ${colorClass ?? ''}`}>
      <InlineMath math={variable.symbol} />
      <span className={styles.tooltip}>
        <strong>{variable.symbol} — {variable.name}</strong>
        {variable.unit && <span className={styles.unit}> ({variable.unit})</span>}
        <p>{variable.definition}</p>
      </span>
    </span>
  )
}
