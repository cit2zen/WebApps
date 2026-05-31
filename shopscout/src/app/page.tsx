import Chat from '@/components/Chat';

export default function Home() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24 }}>🔎 ShopScout</h1>
      <p style={{ color: '#666', marginTop: -8 }}>
        무엇을 왜 사는지 알려주세요. 목적에 맞는, 신뢰할 수 있는 최저가를 찾아드려요.
      </p>
      <Chat />
    </main>
  );
}
