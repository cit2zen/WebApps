'use client';
import type { ReactNode } from 'react';
import { totalPrice, type RankedItem } from '@/lib/types';
import { AlertMark, CheckMark, StarMark } from './Marks';

const FACTOR_NAMES: Record<string, string> = {
  a: '후기',
  b: '정품',
  c: '가격',
  d: '광고',
  e: '목적',
  f: '카테고리',
};

/** 표시할 요소 코드: 후보 중 하나라도 가진 요소만(ProductCard와 동일 집합, f 포함 — bug29) */
const FACTOR_ORDER = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** 상위 후보를 나란히 비교하는 테이블 (E3) */
export default function ComparisonTable({ items }: { items: RankedItem[] }) {
  const top = items.filter((r) => !r.duplicateOf).slice(0, 3); // 동일상품 중복 제외(E6)
  if (top.length < 2) return null;
  return (
    <div className="ss-table-wrap">
      <table className="ss-table pol-table">
        <thead>
          <tr>
            <th>항목</th>
            {top.map((r, i) => (
              <th key={r.listing.id}>
                {i === 0 && r.evaluation.passesTrustThreshold ? (
                  <span className="ss-sr">추천 1위 · </span>
                ) : null}
                {i === 0 && r.evaluation.passesTrustThreshold ? <StarMark size={12} /> : null}
                {r.listing.marketplace}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="가격(총)"
            cells={top.map((r) => (
              <span className="ss-num">{totalPrice(r.listing).toLocaleString()}원</span>
            ))}
          />
          <Row label="신뢰" cells={top.map((r) => <span className="ss-num">{r.evaluation.trustScore}점</span>)} />
          <Row
            label="통과"
            cells={top.map((r) =>
              r.evaluation.passesTrustThreshold ? (
                <span className="ss-verdict is-ok">
                  <CheckMark size={13} />
                  통과
                </span>
              ) : (
                <span className="ss-verdict is-flag">
                  <AlertMark size={13} />
                  주의
                </span>
              ),
            )}
          />
          {FACTOR_ORDER.filter((code) =>
            top.some((r) => r.evaluation.factors.some((x) => x.code === code)),
          ).map((code) => (
            <Row
              key={code}
              label={FACTOR_NAMES[code]}
              cells={top.map((r) => {
                const f = r.evaluation.factors.find((x) => x.code === code);
                return f ? `${f.score}` : '-';
              })}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: ReactNode[] }) {
  return (
    <tr>
      <th scope="row" className="ss-rowlabel">
        {label}
      </th>
      {cells.map((c, i) => (
        <td key={i}>{c}</td>
      ))}
    </tr>
  );
}
