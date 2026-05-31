import Chat from '@/components/Chat';

export default function Home() {
  return (
    <main className="ss-main">
      <header className="ss-header">
        <span className="ss-kicker">
          <span className="ss-dot" />
          AI SHOPPING ADVISOR
        </span>
        <h1 className="ss-title">
          <span className="ss-glow">ShopScout</span>
        </h1>
        <p className="ss-sub">
          무엇을 왜 사는지 알려주세요. 목적에 맞는, 신뢰할 수 있는 최저가를 찾아드려요.
        </p>
      </header>
      <Chat />
    </main>
  );
}
