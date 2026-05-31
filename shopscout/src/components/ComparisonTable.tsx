'use client';
import { totalPrice, type RankedItem } from '@/lib/types';

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
      <table className="ss-table">
        <thead>
          <tr>
            <th>항목</th>
            {top.map((r, i) => (
              <th key={r.listing.id}>
                {i === 0 && r.evaluation.passesTrustThreshold ? '⭐ ' : ''}
                {r.listing.marketplace}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="가격(총)" cells={top.map((r) => `${totalPrice(r.listing).toLocaleString()}원`)} />
          <Row label="신뢰" cells={top.map((r) => `${r.evaluation.trustScore}점`)} />
          <Row label="통과" cells={top.map((r) => (r.evaluation.passesTrustThreshold ? '✅' : '⚠️'))} />
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

function Row({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td className="ss-rowlabel">{label}</td>
      {cells.map((c, i) => (
        <td key={i}>{c}</td>
      ))}
    </tr>
  );
}
