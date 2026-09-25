'use client';
import { totalPrice, type Evaluation, type Listing } from '@/lib/types';
import { AlertMark, ArrowOutMark, StarMark } from './Marks';

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
  const top = rank === 1 && passed;
  // 클릭 직전 목적지 신뢰 단서: URL 도메인 병기(파싱 실패 시 생략)
  let host = '';
  try {
    host = new URL(listing.url).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  return (
    <article className={`ss-card ${passed ? 'pass' : 'flagged'}`}>
      {/* 폴라로이드 인화 — 사진 칸(순위 번호)과 손글씨 캡션. 장식이므로 보조기기에서는 숨김 */}
      <div className="ss-print" aria-hidden>
        <div className="ss-print-photo">
          {top ? <StarMark size={16} className="ss-mark ss-print-badge is-top" /> : null}
          {!passed ? <AlertMark size={16} className="ss-mark ss-print-badge is-flag" /> : null}
          <span className="ss-print-no">no.</span>
          <span className="ss-print-num">{rank}</span>
        </div>
        <span className="ss-print-caption">{listing.marketplace}</span>
      </div>
      <div className="ss-card-head">
        <strong className="ss-card-title">
          {top ? <span className="ss-sr">추천 1위 · </span> : null}
          {listing.title}
        </strong>
        <span className="ss-card-price">{total.toLocaleString()}원</span>
      </div>
      <div className="ss-card-body">
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
            <span className="ss-trust-pill">
              <span className="ss-bdot" />
              신뢰 {evaluation.trustScore} · 평가 근거
            </span>
          </summary>
          <ul>
            {evaluation.factors.map((f) => (
              <li key={f.code}>
                <b>{FACTOR_NAMES[f.code] ?? f.code}</b>: {f.score}점
                {f.flags.length ? (
                  <span className="ss-flag">
                    {' · '}
                    <AlertMark size={12} />
                    {f.flags.join(', ')}
                  </span>
                ) : (
                  ''
                )}{' '}
                — {f.rationale}
              </li>
            ))}
          </ul>
        </details>
        {cheaperThanGroupCount ? (
          <div className="ss-fold">
            같은 상품을 파는 더 비싼 판매처 {cheaperThanGroupCount}곳을 접었어요(이게 최저가).
          </div>
        ) : null}
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="ss-link pol-btn-ghost pol-btn-sm"
          aria-label={`${listing.marketplace}에서 보기 (새 창에서 열림)`}
        >
          {listing.marketplace}에서 보기
          <ArrowOutMark />
          {host ? <span className="ss-link-host">{host}</span> : null}
        </a>
      </div>
    </article>
  );
}
