import type { Metadata } from 'next';
import { Fraunces, Noto_Sans_KR, Noto_Serif_KR, Space_Mono, Nanum_Pen_Script } from 'next/font/google';
import './globals.css';

// Polaroid Editorial v2 폰트 — next/font self-host. 변수는 <html>에 두고 globals.css :root에서 역할 토큰으로 매핑.
// 라틴 디스플레이(Fraunces italic)만 preload, 한글 폰트는 유니코드 범위 분할 로딩이라 preload 끔.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['italic'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: true,
});
const notoSansKr = Noto_Sans_KR({
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-kr',
  display: 'swap',
  preload: false,
});
const notoSerifKr = Noto_Serif_KR({
  weight: ['400', '500'],
  variable: '--font-serif-kr',
  display: 'swap',
  preload: false,
});
const spaceMono = Space_Mono({
  weight: ['400'],
  variable: '--font-space-mono',
  display: 'swap',
  preload: false,
});
const nanumPen = Nanum_Pen_Script({
  weight: '400',
  variable: '--font-nanum-pen',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'ShopScout — 지능형 구매 추천',
  description: '목적을 파악해 신뢰할 수 있는 최저가 매물을 추천하는 채팅형 쇼핑 어드바이저',
};

const fontVars = [fraunces, notoSansKr, notoSerifKr, spaceMono, nanumPen].map((f) => f.variable).join(' ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={fontVars}>
      <body className="pol-body">{children}</body>
    </html>
  );
}
