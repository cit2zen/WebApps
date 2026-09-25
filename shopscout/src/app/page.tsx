import Chat from '@/components/Chat';

/** 헤더 장식용 미니 폴라로이드 3장(검색·가격·신뢰) — 선화 SVG, 색은 currentColor → CSS 토큰 */
const HERO_PRINTS = [
  {
    caption: 'search',
    art: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="M14.6 14.6L20 20" className="ss-art-accent" />
      </>
    ),
  },
  {
    caption: 'price',
    art: (
      <>
        <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z" />
        <circle cx="8" cy="8" r="1.4" className="ss-art-accent" />
      </>
    ),
  },
  {
    caption: 'trust',
    art: (
      <>
        <path d="M12 3l7 3v5.2c0 4.6-3.1 8-7 9.8-3.9-1.8-7-5.2-7-9.8V6z" />
        <path d="M8.8 12.2l2.2 2.2 4.3-4.4" className="ss-art-accent" />
      </>
    ),
  },
];

export default function Home() {
  return (
    <>
      <header className="pol-appbar">
        <a className="pol-brand" href="https://cityzen.kr">
          cityzen
        </a>
        <span className="pol-appbar-sep" aria-hidden />
        <span className="pol-appbar-title">ShopScout</span>
      </header>
      <main className="ss-main">
        <header className="ss-header">
          <div className="ss-header-text">
            <span className="pol-eyebrow">AI 쇼핑 어드바이저</span>
            <h1 className="ss-title t-display">ShopScout</h1>
            <p className="ss-sub t-lead">
              무엇을 왜 사는지 알려주세요. 목적에 맞는, 신뢰할 수 있는 최저가를 찾아드려요.
            </p>
          </div>
          <div className="pol-group ss-hero-art" aria-hidden>
            {HERO_PRINTS.map((p) => (
              <div key={p.caption} className="pol-card">
                <div className="pol-photo">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {p.art}
                  </svg>
                </div>
                <span className="pol-caption">{p.caption}</span>
              </div>
            ))}
          </div>
        </header>
        <Chat />
      </main>
    </>
  );
}
