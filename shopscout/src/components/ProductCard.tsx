'use client';
import { totalPrice, type Evaluation, type Listing } from '@/lib/types';

const FACTOR_NAMES: Record<string, string> = {
  a: '후기 진위',
  b: '사진·정품',
  c: '가격·허위',
  d: '광고·협찬',
  e: '목적 적합성',
  f: '카테고리 전문',
};

export default function ProductCard({
  listing,
  evaluation,
  reason,
  rank,
  cheaperThanGroupCount,
  pros,
  cons,
}: {
  listing: Listing;
  evaluation: Evaluation;
  reason: string;
  rank: number;
  cheaperThanGroupCount?: number;
  pros?: string[];
  cons?: string[];
}) {
  const total = totalPrice(listing);
  const passed = evaluation.passesTrustThreshold;
  return (
    <div
      style={{
        border: `1px solid ${passed ? '#cfe9d4' : '#f0d2d2'}`,
        background: passed ? '#fff' : '#fff7f7',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong>
          {rank === 1 && passed ? '⭐ ' : ''}
          {listing.title}
        </strong>
        <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{total.toLocaleString()}원</span>
      </div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
        {listing.marketplace}
        {listing.rating != null ? ` · ★${listing.rating}` : ''}
        {listing.reviewCount != null ? ` (${listing.reviewCount.toLocaleString()})` : ''} · {reason}
      </div>
      {(pros?.length || cons?.length) ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, flexWrap: 'wrap' }}>
          {pros && pros.length > 0 && (
            <div style={{ color: '#2a7' }}>👍 {pros.join(' · ')}</div>
          )}
          {cons && cons.length > 0 && (
            <div style={{ color: '#c55' }}>👎 {cons.join(' · ')}</div>
          )}
        </div>
      ) : null}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>평가 근거 (신뢰 {evaluation.trustScore})</summary>
        <ul style={{ fontSize: 13, marginTop: 6 }}>
          {evaluation.factors.map((f) => (
            <li key={f.code}>
              <b>{FACTOR_NAMES[f.code] ?? f.code}</b>: {f.score}점
              {f.flags.length ? ` · ⚠ ${f.flags.join(', ')}` : ''} — {f.rationale}
            </li>
          ))}
        </ul>
      </details>
      {cheaperThanGroupCount ? (
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          같은 상품을 파는 더 비싼 판매처 {cheaperThanGroupCount}곳을 접었어요(이게 최저가).
        </div>
      ) : null}
      <div>
        <a href={listing.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
          상품 보기 →
        </a>
      </div>
    </div>
  );
}
