// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Fraunces, Noto_Sans_KR, Noto_Serif_KR, Space_Mono, Nanum_Pen_Script } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['italic'],
  display: 'swap',
  preload: true,
})

const notoSansKr = Noto_Sans_KR({
  variable: '--font-sans-kr',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
})

const notoSerifKr = Noto_Serif_KR({
  variable: '--font-serif-kr',
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
})

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  weight: '400',
  display: 'swap',
  preload: false,
})

const nanumPen = Nanum_Pen_Script({
  variable: '--font-nanum-pen',
  weight: '400',
  display: 'swap',
  preload: false,
})

const fontVars = [fraunces, notoSansKr, notoSerifKr, spaceMono, nanumPen].map(f => f.variable).join(' ')

export const metadata: Metadata = {
  title: 'StudyAI · cityzen',
  description: '개념을 직관부터 수식까지 구조화해서 설명하는 학습 AI',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={fontVars}>
      <body className="pol-body">{children}</body>
    </html>
  )
}
