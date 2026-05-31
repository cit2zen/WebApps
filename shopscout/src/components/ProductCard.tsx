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
    <div className={`ss-card ${passed ? 'pass' : 'flagged'}`}>
      <div className="ss-card-head">
        <strong className="ss-card-title">
          {rank === 1 && passed ? <span className="ss-rank">⭐ </span> : ''}
          {listing.title}
        </strong>
        <span className="ss-card-price">{total.toLocaleString()}원</span>
      </div>
      <div className="ss-card-meta">
        {listing.marketplace}
        {listing.rating != null ? ` · ★${listing.rating}` : ''}
        {listing.reviewCount != null ? ` (${listing.reviewCount.toLocaleString()})` : ''} · {reason}
      </div>
      {(pros?.length || cons?.length) ? (
        <div className="ss-proscons">
          {pros && pros.length > 0 && <div className="ss-pros">👍 {pros.join(' · ')}</div>}
          {cons && cons.length > 0 && <div className="ss-cons">👎 {cons.join(' · ')}</div>}
        </div>
      ) : null}
      <details className={`ss-trust ${passed ? '' : 'flagged'}`}>
        <summary>
          <span className="ss-bdot" />
          신뢰 {evaluation.trustScore} · 평가 근거
        </summary>
        <ul>
          {evaluation.factors.map((f) => (
            <li key={f.code}>
              <b>{FACTOR_NAMES[f.code] ?? f.code}</b>: {f.score}점
              {f.flags.length ? <span className="ss-flag"> · ⚠ {f.flags.join(', ')}</span> : ''} — {f.rationale}
            </li>
          ))}
        </ul>
      </details>
      {cheaperThanGroupCount ? (
        <div className="ss-fold">
          같은 상품을 파는 더 비싼 판매처 {cheaperThanGroupCount}곳을 접었어요(이게 최저가).
        </div>
      ) : null}
      <div>
        <a href={listing.url} target="_blank" rel="noreferrer" className="ss-link">
          상품 보기 →
        </a>
      </div>
    </div>
  );
}
