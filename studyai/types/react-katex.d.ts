declare module 'react-katex' {
  import type { ReactNode } from 'react'
  export function BlockMath(props: { math: string; [key: string]: unknown }): ReactNode
  export function InlineMath(props: { math: string; [key: string]: unknown }): ReactNode
}
