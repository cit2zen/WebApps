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
  // 클릭 직전 목적지 신뢰 단서: URL 도메인 병기(파싱 실패 시 생략)
  let host = '';
  try {
    host = new URL(listing.url).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  return (
    <div className={`ss-card ${passed ? 'pass' : 'flagged'}`}>
      <div className="ss-card-head">
        <strong className="ss-card-title">
          {rank === 1 && passed ? (
            <span className="ss-rank" role="img" aria-label="추천 1위">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z" />
              </svg>
            </span>
          ) : null}
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
          {pros && pros.length > 0 && (
            <div className="ss-pros">
              <span className="ss-pc-label">장점</span>
              <span>{pros.join(' · ')}</span>
            </div>
          )}
          {cons && cons.length > 0 && (
            <div className="ss-cons">
              <span className="ss-pc-label">단점</span>
              <span>{cons.join(' · ')}</span>
            </div>
          )}
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
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="ss-link"
          aria-label={`${listing.marketplace}에서 보기 (새 창에서 열림)`}
        >
          {listing.marketplace}에서 보기
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {host ? <span className="ss-link-host">{host}</span> : null}
        </a>
      </div>
    </div>
  );
}
