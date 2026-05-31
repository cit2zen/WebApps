import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ShopScout — 지능형 구매 추천',
  description: '목적을 파악해 신뢰할 수 있는 최저가 매물을 추천하는 채팅형 쇼핑 어드바이저',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fafafa' }}>
        {children}
      </body>
    </html>
  );
}
