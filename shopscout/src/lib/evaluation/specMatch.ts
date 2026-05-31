import type { Listing, PurchaseIntent } from '@/lib/types';

/**
 * 소문자화 + 구분기호 제거 후, 공백은 '제거'하지 않고 단일 공백으로 보존한다.
 * 이렇게 하면 단어 경계가 유지되어, 부분일치 시 경계를 넘는 오탐을 막을 수 있다.
 * (구분기호 `\-_/().,` 등은 공백으로 치환 → 그 자리도 단어 경계가 된다)
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\-_/().,]/g, ' ') // 구분기호는 단어 경계(공백)로
    .replace(/\s+/g, ' ') // 연속 공백 축약
    .trim();
}

/** 비교용으로 공백까지 모두 제거한 무공백 정규형 */
function stripped(s: string): string {
  return normalize(s).replace(/\s+/g, '');
}

/** 매물에서 텍스트 검색 대상(제목·사양값·판매자)을 단어 경계를 보존한 정규화 문자열로 */
function haystack(l: Listing): string {
  const parts = [l.title, l.seller ?? '', ...Object.values(l.rawSpecs ?? {})];
  return normalize(parts.join(' '));
}

/**
 * 경계 인지 부분일치.
 * - term은 사용자 입력이므로 공백/기호를 무시(무공백 정규형)해 비교한다. (예: '무 선' → '무선')
 * - hay는 단어 경계를 보존한 상태로, '토큰 경계에서 시작하고 토큰 경계에서 끝나는' 매칭만 허용한다.
 *   즉 hay를 공백으로 나눈 인접 토큰들을 결합한 후보들과 term의 무공백 정규형을 비교한다.
 *   이로써 인접한 두 필드/단어 경계를 가로지르는 우연한 매칭(오탐)을 차단한다.
 */
function contains(hay: string, term: string): boolean {
  const t = stripped(term);
  if (t.length === 0) return false;
  const tokens = hay.split(' ').filter((x) => x.length > 0);
  for (let i = 0; i < tokens.length; i++) {
    let cand = '';
    for (let j = i; j < tokens.length; j++) {
      cand += tokens[j];
      if (cand.length > t.length) break; // 더 길어지면 이 시작점에선 불가능
      if (cand === t) return true; // 토큰 경계에서 시작·종료하는 일치
    }
  }
  return false;
}

/**
 * 절대 배제조건(dealbreakers)이 매물 텍스트에 문자 그대로 나타나면 반환.
 * 고정밀(리터럴 존재) → 하드 배제에 사용해도 오탐 적음.
 */
export function deterministicDealbreakers(l: Listing, intent: PurchaseIntent): string[] {
  const hay = haystack(l);
  return intent.dealbreakers.filter((d) => contains(hay, d));
}

/**
 * 필수조건(mustHaves)의 리터럴 충족 현황. 미충족(unmet)은 표현 차이로 인한 오탐 위험이 있어
 * 하드 게이트가 아니라 LLM(ⓔ)에 주는 힌트로만 사용한다.
 */
export function mustHaveLiteralStatus(
  l: Listing,
  intent: PurchaseIntent,
): { met: string[]; unmet: string[] } {
  const hay = haystack(l);
  const met: string[] = [];
  const unmet: string[] = [];
  for (const m of intent.mustHaves) {
    (contains(hay, m) ? met : unmet).push(m);
  }
  return { met, unmet };
}
