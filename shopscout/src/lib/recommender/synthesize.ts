import {
  totalPrice,
  type Evaluation,
  type Listing,
  type PurchaseIntent,
  type Recommendation,
} from '@/lib/types';
import { groupSameProduct } from './group';

/**
 * 평가 결과를 종합하여 랭킹과 질의 트리거를 만든다.
 * 목표 함수: 예산 내 · 신뢰 임계 통과 매물 중 최저가 우선.
 * LLM 비의존 — 결정적.
 */
export function synthesize(
  listings: Listing[],
  evals: Evaluation[],
  intent?: PurchaseIntent,
): Recommendation {
  const byId = new Map(evals.map((e) => [e.listingId, e]));
  const max = intent?.budgetKRW?.max;
  const maxDays = intent?.maxDeliveryDays;
  type Row = {
    listing: Listing;
    evaluation: Evaluation;
    overBudget: boolean;
    overDeadline: boolean;
    deliveryUnknown: boolean;
  };
  const rows: Row[] = listings
    .map((l) => ({
      listing: l,
      evaluation: byId.get(l.id),
      // 양수 상한만 유효 — max=0/음수(오추출)면 '상한 없음'으로 보고 매물을 버리지 않는다(자체감사 A2)
      overBudget: typeof max === 'number' && max > 0 && totalPrice(l) > max,
      // 기한 초과는 '소요일을 알고 초과'한 경우만(소요일 미상은 별도 표시).
      overDeadline: maxDays != null && l.deliveryDays != null && l.deliveryDays > maxDays,
      // 기한이 있는데 배송 소요일을 모름 — 기한 보장 불가(가시화 + 동급 시 후순위, bug18)
      deliveryUnknown: maxDays != null && l.deliveryDays == null,
    }))
    .filter((r): r is Row => r.evaluation != null);

  // 인프라 전량 실패 감지(bug6): 모든 매물의 표준요소(ⓐ~ⓔ)가 전부 인프라 실패면
  // '매물이 다 위험'이 아니라 '평가 시스템 장애'다. 오해 메시지/질의를 막고 degraded로 표시한다.
  // 표준요소(ⓐ~ⓔ)가 실제로 존재하고 그 전부가 인프라 실패일 때만 '평가 시스템 장애'로 본다.
  // nonF가 비면 [].every()===true(vacuous)라 ⓕ만 있는/빈 factors를 오분류하므로 length>0 가드(자체감사 A6).
  const allInfraFailed =
    rows.length > 0 &&
    rows.every((r) => {
      const nonF = r.evaluation.factors.filter((f) => f.code !== 'f');
      return nonF.length > 0 && nonF.every((f) => f.infraFailure === true);
    });

  const eligible = (r: (typeof rows)[number]) =>
    r.evaluation.passesTrustThreshold && !r.overBudget && !r.overDeadline;

  // 통과 = 신뢰 임계 통과 && 예산 내 && 배송기한 내. 정렬은 최저가 우선 + 근소 가격대 tie-break.
  // 동급(가격·신뢰 근소)이면 배송 소요일을 아는 매물을 미상 매물보다 앞세운다(bug18).
  const passing = rows.filter(eligible).sort(rankCompare);
  const rest = rows.filter((r) => !eligible(r)).sort(rankCompare);

  // 분류별 reason 생성 (통과/탈락 공통 로직)
  const toRankInput = (r: (typeof rows)[number]) => {
    const { pros, cons } = buildProsCons(
      r.evaluation,
      r.overBudget,
      r.overDeadline,
      r.listing.deliveryDays,
      r.deliveryUnknown ? maxDays : undefined,
    );
    return {
      listing: r.listing,
      evaluation: r.evaluation,
      reason: r.overBudget
        ? `예산 초과 · 총 ${totalPrice(r.listing).toLocaleString()}원`
        : r.overDeadline
          ? `배송기한 초과(${r.listing.deliveryDays}일)`
          : r.evaluation.passesTrustThreshold
            ? `신뢰 ${r.evaluation.trustScore}점 · 총 ${totalPrice(r.listing).toLocaleString()}원`
            : `신뢰 임계 미달(${r.evaluation.trustScore}점)`,
      pros,
      cons,
    };
  };

  // 동일 분류(passing끼리, rest끼리)만 한 그룹으로 묶는다.
  // passing과 rest를 섞어서 groupSameProduct에 넘기면, 통과 대표 아래에 탈락(신뢰 미달·예산 초과)
  // 동일상품이 접혀 cheaperThanGroupCount('같은 분류의 더 비싼 동일상품 수') 의미가 오염된다.
  const ranked = [
    ...groupSameProduct(passing.map(toRankInput)),
    ...groupSameProduct(rest.map(toRankInput)),
  ];

  // 질의 트리거 판정 — '신뢰 위험' 질의는 예산 내 매물에 한해 판단(예산 초과를 신뢰문제로 오인 방지)
  const inBudget = rows.filter((r) => !r.overBudget);
  const cheapest = inBudget
    .slice()
    .sort((a, b) => totalPrice(a.listing) - totalPrice(b.listing))[0];
  const cheapestFailed = cheapest && !cheapest.evaluation.passesTrustThreshold;
  // '대안있음'은 통제 어휘를 쓰는 표준 요소(ⓐ~ⓔ)에서만 인정 — ⓕ 자유 플래그 오트리거 방지(#34)
  const hasAlternative = rows.some((r) =>
    r.evaluation.factors.some((f) => f.code !== 'f' && f.flags.includes('대안있음')),
  );
  const closeTop =
    passing.length >= 2 &&
    Math.abs(passing[0].evaluation.trustScore - passing[1].evaluation.trustScore) <= 5 &&
    Math.abs(totalPrice(passing[0].listing) - totalPrice(passing[1].listing)) <= 5000;

  let askUser: Recommendation['askUser'];
  // 인프라 전량 실패면 어떤 질의도 띄우지 않는다(신뢰 평가가 실제로 돌지 않았으므로 'cheapest-failed' 등은 거짓 귀속).
  if (allInfraFailed) {
    askUser = undefined;
  } else if (cheapestFailed) {
    askUser = {
      question: `최저가 매물(${cheapest.listing.title})은 신뢰 위험 신호가 있어 제외했어요. 그래도 보시겠어요, 아니면 안전한 다음 후보로 갈까요?`,
      options: ['위험 매물도 보기', '안전한 다음 후보'],
      reason: 'cheapest-failed',
    };
  } else if (hasAlternative) {
    askUser = {
      question: '지금 찾으시는 것보다 목적에 더 맞는 대안이 있을 수 있어요. 비교해 보시겠어요?',
      options: ['대안 비교', '현재 후보 유지'],
      reason: 'alternative',
    };
  } else if (closeTop) {
    askUser = {
      question: '상위 두 후보가 비슷해요. 어떤 점을 더 중요하게 보세요?',
      options: ['가격', '후기/신뢰'],
      reason: 'close-top',
    };
  }

  // 인프라 전량 실패면 '신뢰 통과 없음'(매물 탓)이 아니라 '평가 시스템 오류'로 정직하게 알리고 degraded 표시.
  if (allInfraFailed) {
    return {
      ranked,
      askUser: undefined,
      summary: '평가 시스템 일시 오류로 매물을 채점하지 못했어요. 잠시 후 다시 시도해 주세요.',
      degraded: true,
    };
  }

  const summary = buildSummary(passing, rows.length, max);
  return { ranked, askUser, summary };
}

type RankRow = { listing: Listing; evaluation: Evaluation };
function factorScore(r: RankRow, code: string): number {
  return r.evaluation.factors.find((f) => f.code === code)?.score ?? 0;
}

/**
 * 랭킹 비교자: 1차 최저가. 단 가격차가 근소(5% 또는 5천원 이내)하면
 * 신뢰점수 높은 쪽 → 가격 적정성(ⓒ) 높은 쪽 순으로 tie-break (가성비 나쁜 최저가 1순위 방지).
 */
function rankCompare(a: RankRow, b: RankRow): number {
  const pa = totalPrice(a.listing);
  const pb = totalPrice(b.listing);
  const close = Math.max(5000, Math.min(pa, pb) * 0.05);
  if (Math.abs(pa - pb) > close) return pa - pb;
  if (b.evaluation.trustScore !== a.evaluation.trustScore) {
    return b.evaluation.trustScore - a.evaluation.trustScore;
  }
  const cDiff = factorScore(b, 'c') - factorScore(a, 'c');
  if (cDiff !== 0) return cDiff;
  // 최종 tie-break: 배송 소요일을 아는 매물을 미상 매물보다 앞세운다(기한 보장성, bug18)
  const aKnown = a.listing.deliveryDays != null ? 0 : 1;
  const bKnown = b.listing.deliveryDays != null ? 0 : 1;
  return aKnown - bKnown;
}

const FACTOR_LABEL: Record<string, string> = {
  a: '후기 신뢰도',
  b: '정품·사양 일치',
  c: '가격 적정성',
  d: '광고 청정도',
  e: '목적 적합성',
  f: '카테고리 적합성',
};

/** 평가 결과에서 장점/단점을 결정적으로 도출 */
export function buildProsCons(
  evaluation: Evaluation,
  overBudget: boolean,
  overDeadline: boolean,
  deliveryDays?: number,
  /** 기한이 지정됐는데 배송 소요일을 모를 때의 마감일수(미상 표시용, bug18) */
  deadlineForUnknown?: number,
): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  for (const f of evaluation.factors) {
    if (f.confidence <= 0) continue;
    const label = FACTOR_LABEL[f.code] ?? f.code;
    // ⓕ는 기준별 점수로 구체 근거를 노출(설명가능성)
    if (f.code === 'f' && f.criterionScores && f.criterionScores.length > 0) {
      for (const cs of f.criterionScores) {
        if (cs.dataInsufficient || cs.confidence <= 0) continue;
        if (cs.flags.length > 0 && cs.score < 50) cons.push(`${cs.label ?? cs.key} 우려(${cs.score})`);
        else if (cs.score >= 80) pros.push(`${cs.label ?? cs.key} 우수(${cs.score})`);
      }
      continue;
    }
    // '대안있음'은 결함이 아니라 정보성 플래그(더 나은 대안 안내)이므로 우려 플래그에서 제외
    const concernFlags = f.flags.filter((fl) => fl !== '대안있음');
    if (concernFlags.length > 0) cons.push(`${label} 우려: ${concernFlags.join(', ')}`);
    else if (f.score >= 75) pros.push(`${label} 우수(${f.score})`);
    else if (f.score < 50 && !f.dataInsufficient) cons.push(`${label} 미흡(${f.score})`);
  }
  if (overBudget) cons.push('예산 초과');
  if (overDeadline) cons.push(`배송 느림(${deliveryDays}일)`);
  else if (deliveryDays != null && deliveryDays <= 2) pros.push(`빠른 배송(${deliveryDays}일)`);
  // 기한이 있는데 소요일 미상 — 기한 보장 불가를 명시(숨겨진 마감 위반 방지, bug18)
  if (deadlineForUnknown != null) cons.push(`배송기간 미상(마감 ${deadlineForUnknown}일 확인 불가)`);
  return { pros: pros.slice(0, 5), cons: cons.slice(0, 5) };
}

/** 추천 이유를 결정적으로 한두 문장 요약 (LLM 비의존) */
function buildSummary(
  passing: { listing: Listing; evaluation: Evaluation }[],
  totalCount: number,
  budgetMax?: number,
): string {
  if (passing.length === 0) {
    return `검토한 ${totalCount}개 매물 중 신뢰 기준을 통과한 게 없어요. 위험 신호가 있는 후보만 남아 추천을 보류했어요.`;
  }
  const top = passing[0];
  const price = totalPrice(top.listing).toLocaleString();
  const budgetNote = budgetMax ? `예산(${budgetMax.toLocaleString()}원) 내에서 ` : '';
  const altNote =
    passing.length > 1 ? ` 비슷한 대안 ${passing.length - 1}개도 함께 비교할 수 있어요.` : '';
  return `${budgetNote}신뢰 기준을 통과한 매물 중 가장 저렴한 "${top.listing.title}"(${top.listing.marketplace}, 총 ${price}원, 신뢰 ${top.evaluation.trustScore}점)를 1순위로 추천해요.${altNote}`;
}
