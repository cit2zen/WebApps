/** 작은 SVG 표식 — 이모지(⭐✅⚠️) 대신 쓰는 키트 색상 마크. 색은 currentColor → CSS 토큰으로 지정. */
type MarkProps = { size?: number; className?: string };

export function StarMark({ size = 14, className = 'ss-mark ss-mark-star' }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z" />
    </svg>
  );
}

export function CheckMark({ size = 14, className = 'ss-mark ss-mark-ok' }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M5 12.5l4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertMark({ size = 14, className = 'ss-mark ss-mark-warn' }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3.5L2.8 19.5h18.4z" strokeLinejoin="round" />
      <path d="M12 10v4.2" strokeLinecap="round" />
      <circle cx="12" cy="16.9" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ArrowOutMark({ size = 13, className = 'ss-mark' }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
