'use client';
import { useEffect, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import ComparisonTable from './ComparisonTable';
import { readNdjson } from '@/lib/util/ndjson';
import type { Recommendation } from '@/lib/types';

type Msg = { role: 'user' | 'bot'; text?: string; rec?: Recommendation; failedSources?: string[] };

const SOURCE_LABEL: Record<string, string> = { kr: '국내', global: '해외', mock: '목' };
const STAGE_LABEL: Record<string, string> = {
  understanding: '구매 목적 파악 중…',
  searching: '국내·해외 매물 검색 중…',
  evaluating: '매물 신뢰도 평가 중…',
  ranking: '최적 추천 정리 중…',
};

/** CSPRNG 기반 128비트 turnKey (대화 접근 토큰이므로 추측 불가해야 함) */
function randomTurnKey(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return 't-' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** localStorage에 turnKey를 유지해 새로고침/재방문 시 같은 대화를 복원(E4) */
function loadTurnKey(): string {
  if (typeof window === 'undefined') return 't-server';
  const existing = window.localStorage.getItem('shopscout-turnkey');
  if (existing) return existing;
  const fresh = randomTurnKey();
  window.localStorage.setItem('shopscout-turnkey', fresh);
  return fresh;
}

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  // 카드/비교표 토글은 추천 블록(메시지 인덱스)별로 독립 — 전역 상태면 모든 블록이 함께 토글됨(bug27)
  const [views, setViews] = useState<Record<number, 'cards' | 'table'>>({});
  const turnKeyRef = useRef('t-init');

  // 마운트 시 turnKey 확정 + 직전 추천 복원
  useEffect(() => {
    turnKeyRef.current = loadTurnKey();
    let aborted = false;
    fetch(`/api/chat?turnKey=${encodeURIComponent(turnKeyRef.current)}`)
      .then((r) => r.json())
      .then((data) => {
        if (aborted) return;
        // 저장 JSON이 손상돼 ranked가 배열이 아니면 복원하지 않는다(렌더 throw 방지, bug34)
        if (
          data.kind === 'history' &&
          data.recommendation &&
          Array.isArray((data.recommendation as Recommendation).ranked)
        ) {
          setMsgs((m) => [
            ...m,
            { role: 'bot', text: '이전 대화에서 추천한 내용이에요.' },
            { role: 'bot', rec: data.recommendation as Recommendation },
          ]);
        }
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  async function sendText(raw: string) {
    const u = raw.trim();
    if (!u || loading) return;
    setMsgs((m) => [...m, { role: 'user', text: u }]);
    setLoading(true);
    setStage('understanding');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnKey: turnKeyRef.current, utterance: u }),
      });
      await readNdjson(res, (msg) => {
        if (msg.type === 'progress') {
          setStage(msg.stage);
          return;
        }
        // type === 'result'
        const data = msg;
        if (data.kind === 'question') {
          setMsgs((m) => [
            ...m,
            {
              role: 'bot',
              text: data.question,
              rec: { ranked: [], askUser: { question: data.question, options: data.options, reason: '' } } as Recommendation,
            },
          ]);
        } else if (data.kind === 'recommendation') {
          setMsgs((m) => [
            ...m,
            { role: 'bot', rec: data.recommendation as Recommendation, failedSources: data.failedSources },
          ]);
        } else {
          setMsgs((m) => [...m, { role: 'bot', text: '오류: ' + (data.message ?? '알 수 없음') }]);
        }
      });
    } catch (e) {
      setMsgs((m) => [...m, { role: 'bot', text: '네트워크 오류: ' + String(e) }]);
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  async function send() {
    const u = input;
    setInput('');
    await sendText(u);
  }

  /** 새 대화 시작: 새 turnKey 발급 + 화면/이력 초기화 */
  function resetConversation() {
    if (loading) return;
    const fresh = randomTurnKey();
    if (typeof window !== 'undefined') window.localStorage.setItem('shopscout-turnkey', fresh);
    turnKeyRef.current = fresh;
    setMsgs([]);
    setInput('');
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={resetConversation} disabled={loading} style={tab(false)} aria-label="새 대화">
          + 새 대화
        </button>
      </div>
      <div style={{ minHeight: 320, marginBottom: 12 }}>
        {msgs.map((m, i) => {
          const view = views[i] ?? 'cards';
          // 비교표는 동일상품 중복 제외 후 2개 이상일 때만 의미가 있다(ComparisonTable 내부 필터와 일치, bug28)
          const comparableCount = m.rec ? m.rec.ranked.filter((r) => !r.duplicateOf).length : 0;
          return (
          <div key={i} style={{ margin: '10px 0' }}>
            {m.text && !m.rec && (
              <div>
                <b>{m.role === 'user' ? '나' : 'ShopScout'}:</b> {m.text}
              </div>
            )}
            {m.rec && (
              <div>
                {m.rec.summary && (
                  <div style={{ background: '#eef6ff', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    💡 {m.rec.summary}
                    {m.rec.priorityNote && (
                      <div style={{ marginTop: 6, fontSize: 13, color: '#456' }}>
                        🎯 {m.rec.priorityNote}
                      </div>
                    )}
                    {m.rec.appliedCriteria && m.rec.appliedCriteria.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#678' }}>
                        📋 이번에 본 기준: {m.rec.appliedCriteria.slice(0, 10).join(' · ')}
                      </div>
                    )}
                  </div>
                )}
                {m.rec.askUser && (
                  <div style={{ marginBottom: 8 }}>
                    <div>
                      <b>ShopScout:</b> {m.rec.askUser.question}
                    </div>
                    {m.rec.askUser.options && m.rec.askUser.options.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {m.rec.askUser.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => sendText(opt)}
                            disabled={loading}
                            style={chip}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {comparableCount >= 2 && (
                  <div style={{ marginBottom: 6 }}>
                    <button onClick={() => setViews((v) => ({ ...v, [i]: 'cards' }))} style={tab(view === 'cards')}>
                      카드
                    </button>
                    <button onClick={() => setViews((v) => ({ ...v, [i]: 'table' }))} style={tab(view === 'table')}>
                      비교표
                    </button>
                  </div>
                )}
                {m.rec.ranked.length > 0 &&
                  (view === 'table' ? (
                    <ComparisonTable items={m.rec.ranked} />
                  ) : (
                    m.rec.ranked
                      .filter((r) => !r.duplicateOf) // 동일상품 더 비싼 판매처는 접음(E6)
                      .map((r, idx) => <ProductCard key={r.listing.id} {...r} rank={idx + 1} />)
                  ))}
                {m.rec.ranked.length === 0 && !m.rec.askUser && (
                  <div>
                    {m.rec.degraded
                      ? '⚠️ 일시적으로 모든 쇼핑몰 검색에 실패했어요. 잠시 후 다시 시도해 주세요.'
                      : '조건에 맞는 매물을 찾지 못했어요.'}
                  </div>
                )}
                {m.failedSources && m.failedSources.length > 0 && (
                  <div style={{ fontSize: 12, color: '#a66', marginTop: 4 }}>
                    ⚠ 일부 소스에서 결과를 못 가져왔어요:{' '}
                    {m.failedSources.map((s) => SOURCE_LABEL[s] ?? s).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
        {loading && (
          <div style={{ color: '#888' }}>
            <span style={{ display: 'inline-block', marginRight: 6 }}>⏳</span>
            {stage ? STAGE_LABEL[stage] ?? 'ShopScout가 찾는 중…' : 'ShopScout가 찾는 중…'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          placeholder="무엇을 찾으세요? (예: 코딩용 무선 기계식 키보드 10만원)"
        />
        <button onClick={send} disabled={loading} style={{ padding: '10px 16px', borderRadius: 8 }}>
          보내기
        </button>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 16,
  border: '1px solid #bcd',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};

function tab(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    marginRight: 6,
    borderRadius: 6,
    border: '1px solid #ccc',
    background: active ? '#333' : '#fff',
    color: active ? '#fff' : '#333',
    cursor: 'pointer',
    fontSize: 13,
  };
}
