'use client';
import { useEffect, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import ComparisonTable from './ComparisonTable';
import { readNdjson } from '@/lib/util/ndjson';
import type { Recommendation } from '@/lib/types';

type Msg = { role: 'user' | 'bot'; text?: string; rec?: Recommendation; failedSources?: string[]; error?: boolean };

const SOURCE_LABEL: Record<string, string> = { kr: '국내', global: '해외', mock: '목' };
const STAGE_LABEL: Record<string, string> = {
  understanding: '구매 목적 파악 중…',
  searching: '국내·해외 매물 검색 중…',
  evaluating: '매물 신뢰도 평가 중…',
  ranking: '최적 추천 정리 중…',
};
/** 첫 진입 온보딩 예시(클릭 즉시 sendText) */
const EXAMPLE_PROMPTS = [
  '코딩용 무선 기계식 키보드 10만원',
  '러닝용 무선 이어폰',
  '입문용 미러리스 카메라',
  '재택근무용 인체공학 의자',
];
/** 카드 자리를 예고하는 스켈레톤은 검색 이후 단계에서만 노출 */
const SKELETON_STAGES = new Set(['searching', 'evaluating', 'ranking']);

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
  // 직전 사용자 발화 — 에러 '다시 시도' 재전송용
  const lastUtteranceRef = useRef('');
  // 새 메시지/스트리밍 시 하단 자동 스크롤 앵커
  const streamEndRef = useRef<HTMLDivElement>(null);

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

  // 새 메시지/단계 변화 시 하단으로 스크롤(채팅 UX 기본). reduced-motion이면 즉시 이동.
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    streamEndRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs, stage]);

  async function sendText(raw: string) {
    const u = raw.trim();
    if (!u || loading) return;
    lastUtteranceRef.current = u;
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
          if (data.message) console.error('[ShopScout] 서버 오류:', data.message);
          setMsgs((m) => [
            ...m,
            { role: 'bot', error: true, text: '추천을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' },
          ]);
        }
      });
    } catch (e) {
      console.error('[ShopScout] 네트워크 오류:', e);
      setMsgs((m) => [
        ...m,
        { role: 'bot', error: true, text: '네트워크 연결에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' },
      ]);
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

  /** 에러 후 직전 발화 재전송 */
  function retryLast() {
    if (loading || !lastUtteranceRef.current) return;
    void sendText(lastUtteranceRef.current);
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
    <div className="ss-chat">
      <div className="ss-toolbar">
        <button onClick={resetConversation} disabled={loading} className="ss-btn ghost" aria-label="새 대화">
          + 새 대화
        </button>
      </div>
      <div className="ss-stream" role="log" aria-live="polite" aria-atomic="false">
        {msgs.length === 0 && !loading && (
          <div className="ss-empty-state">
            <p className="ss-welcome">
              무엇을 왜 사는지 알려주시면, <span>목적에 맞는 신뢰할 수 있는 최저가</span>를 찾아드려요.
            </p>
            <span className="ss-hint">이렇게 물어보세요</span>
            <div className="ss-examples" role="group" aria-label="예시 검색">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button key={ex} onClick={() => sendText(ex)} disabled={loading} className="ss-chip">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          const view = views[i] ?? 'cards';
          // 비교표는 동일상품 중복 제외 후 2개 이상일 때만 의미가 있다(ComparisonTable 내부 필터와 일치, bug28)
          const comparableCount = m.rec ? m.rec.ranked.filter((r) => !r.duplicateOf).length : 0;
          return (
          <div key={i} className="ss-turn">
            {m.error && (
              <div className="ss-error" role="alert">
                <span className="ss-error-label">오류</span>
                <span>{m.text}</span>
                <button type="button" onClick={retryLast} disabled={loading} className="ss-btn ghost">
                  다시 시도
                </button>
              </div>
            )}
            {m.text && !m.rec && !m.error && (
              <div className={`ss-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
                <span className="ss-who">{m.role === 'user' ? '나' : 'ShopScout'}</span>
                {m.text}
              </div>
            )}
            {m.rec && (
              <div className="ss-turn">
                {m.rec.summary && (
                  <div className="ss-summary">
                    {m.rec.summary}
                    {m.rec.priorityNote && (
                      <div className="ss-note">
                        <span className="ss-label">우선순위</span>
                        <span>{m.rec.priorityNote}</span>
                      </div>
                    )}
                    {m.rec.appliedCriteria && m.rec.appliedCriteria.length > 0 && (
                      <div className="ss-criteria">
                        <span className="ss-label">기준</span>
                        <span>{m.rec.appliedCriteria.slice(0, 10).join(' · ')}</span>
                      </div>
                    )}
                  </div>
                )}
                {m.rec.askUser && (
                  <div className="ss-turn">
                    <div className="ss-bubble bot">
                      <span className="ss-who">ShopScout</span>
                      {m.rec.askUser.question}
                    </div>
                    {m.rec.askUser.options && m.rec.askUser.options.length > 0 && (
                      <div className="ss-chips" role="group" aria-label="추천 옵션">
                        {m.rec.askUser.options.map((opt) => (
                          <button key={opt} onClick={() => sendText(opt)} disabled={loading} className="ss-chip">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {comparableCount >= 2 && (
                  <div className="ss-tabs" role="group" aria-label="보기 전환">
                    <button
                      type="button"
                      onClick={() => setViews((v) => ({ ...v, [i]: 'cards' }))}
                      aria-pressed={view === 'cards'}
                      className={`ss-tab ${view === 'cards' ? 'active' : ''}`}
                    >
                      카드
                    </button>
                    <button
                      type="button"
                      onClick={() => setViews((v) => ({ ...v, [i]: 'table' }))}
                      aria-pressed={view === 'table'}
                      className={`ss-tab ${view === 'table' ? 'active' : ''}`}
                    >
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
                  <div className="ss-empty">
                    {m.rec.degraded
                      ? '⚠️ 일시적으로 모든 쇼핑몰 검색에 실패했어요. 잠시 후 다시 시도해 주세요.'
                      : '조건에 맞는 매물을 찾지 못했어요.'}
                  </div>
                )}
                {m.failedSources && m.failedSources.length > 0 && (
                  <div className="ss-warn">
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
          <div className="ss-loading" role="status">
            <span className="ss-spinner" aria-hidden />
            {stage ? STAGE_LABEL[stage] ?? 'ShopScout가 찾는 중…' : 'ShopScout가 찾는 중…'}
          </div>
        )}
        {loading && stage && SKELETON_STAGES.has(stage) && (
          <div className="ss-skel-group" aria-hidden>
            {[0, 1, 2].map((k) => (
              <div key={k} className="ss-skel-card">
                <div className="ss-skeleton" style={{ width: '60%' }} />
                <div className="ss-skeleton" style={{ width: '85%' }} />
                <div className="ss-skeleton" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        )}
        <div ref={streamEndRef} />
      </div>
      <form
        className="ss-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="ss-input"
          aria-label="상품 검색 입력"
          placeholder="무엇을 찾으세요? (예: 코딩용 무선 기계식 키보드 10만원)"
        />
        <button type="submit" disabled={loading} className="ss-btn primary">
          보내기
        </button>
      </form>
    </div>
  );
}
