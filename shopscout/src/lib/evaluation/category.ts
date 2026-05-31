import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import type { CriterionScore, FactorResult, Listing, PurchaseIntent } from '@/lib/types';
import type { ResolvedRubric } from '@/lib/taxonomy/types';
import { COMMON_GUARD } from './prompts';
import { sanitize } from '@/lib/util/sanitize';

const criterionScoreSchema = z.object({
  key: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  dataInsufficient: z.boolean().optional(),
  flags: z.array(z.string()).default([]),
});
const schema = z.object({
  criterionScores: z.array(criterionScoreSchema).default([]),
  rationale: z.string().default(''),
});

function listingContext(l: Listing): string {
  const data = {
    title: sanitize(l.title),
    priceKRW: l.priceKRW,
    specs: l.rawSpecs,
    detailedSpecs: l.detailedSpecs,
    nutrition: l.nutrition,
    material: l.material,
    deliveryDays: l.deliveryDays,
    reviewCount: l.reviewCount,
    rating: l.rating,
  };
  return `<listing_data>\n${JSON.stringify(data, null, 2)}\n</listing_data>`;
}

/**
 * 카테고리 전문 평가(ⓕ): 기준별 점수를 LLM이 반환하고, 코드에서 루브릭 weight로 가중합한다.
 * → prioritizeRubric이 재조정한 가중치가 결정적으로 종합 점수에 반영되고, 기준별 근거가 남는다.
 */
export async function evaluateCategory(
  llm: LlmClient,
  l: Listing,
  intent: PurchaseIntent,
  rubric: ResolvedRubric,
): Promise<FactorResult> {
  if (rubric.criteria.length === 0) {
    return { code: 'f', score: 50, confidence: 0, flags: [], rationale: '카테고리 기준 없음', dataInsufficient: true };
  }

  const criteriaText = rubric.criteria
    .map(
      (c) =>
        `- key=${c.key} [${c.label}] (가중치 ${c.weight}) ${c.check} | 필요데이터: ${c.dataNeeded.join(', ') || '없음'} | 위험신호: ${c.redFlags.join(', ') || '없음'}`,
    )
    .join('\n');

  const system =
    `너는 "${rubric.nodeName}" 카테고리 전문 평가자다. 아래 각 기준에 대해 매물을 0~100으로 채점하라.\n` +
    `criterionScores 배열에 각 기준의 {key, score, confidence, dataInsufficient, flags}를 반환한다(key는 위 목록의 key 그대로).\n` +
    `- 그 기준의 필요데이터가 매물에 없으면 점수를 지어내지 말고 confidence를 낮추고 dataInsufficient=true.\n` +
    `- 그 기준의 위험신호가 보이면 flags에 해당 위험신호 문구를 넣어라.\n` +
    `건강 관련은 정보 제공일 뿐 의학적 조언이 아니다.\n\n평가 기준:\n${criteriaText}\n\n${COMMON_GUARD}`;

  let parsed: z.infer<typeof schema>;
  try {
    parsed = await llm.structured({
      key: `evalcat:${l.id}:${rubric.nodeId}`,
      system,
      prompt: `구매목적:\n${JSON.stringify(intent)}\n\n${listingContext(l)}`,
      schema,
    });
  } catch {
    return {
      code: 'f',
      score: 0,
      confidence: 0,
      flags: ['평가불가'],
      rationale: '카테고리 평가 호출 실패',
      dataInsufficient: true,
      infraFailure: true,
    };
  }

  return aggregateCategory(rubric, parsed.criterionScores, parsed.rationale);
}

/** 기준별 점수를 루브릭 weight로 가중합해 ⓕ FactorResult로 종합 (결정적) */
export function aggregateCategory(
  rubric: ResolvedRubric,
  scores: Array<{ key: string; score: number; confidence: number; dataInsufficient?: boolean; flags: string[] }>,
  rationale: string,
): FactorResult {
  const byKey = new Map(scores.map((s) => [s.key, s]));
  const criterionScores: CriterionScore[] = rubric.criteria.map((c) => {
    const s = byKey.get(c.key);
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score: s?.score ?? 0,
      confidence: s ? s.confidence : 0,
      dataInsufficient: s ? s.dataInsufficient : true,
      flags: s?.flags ?? [],
    };
  });

  // 가중합: Σ(score * weight * confidence) / Σ(weight * confidence)
  let wsum = 0;
  let wtot = 0;
  for (const cs of criterionScores) {
    const w = (cs.weight ?? 0.2) * cs.confidence;
    wsum += cs.score * w;
    wtot += w;
  }
  const score = wtot > 0 ? Math.round(wsum / wtot) : 50;
  // 종합 confidence = 데이터 있는 기준 비율
  const covered = criterionScores.filter((cs) => !cs.dataInsufficient && cs.confidence > 0).length;
  const confidence = criterionScores.length > 0 ? covered / criterionScores.length : 0;
  // 빈/공백 토큰은 표시·매칭 양쪽에서 제외(자체감사 A3)
  const flags = [...new Set(criterionScores.flatMap((cs) => cs.flags.map((x) => x.trim()).filter(Boolean)))];
  // 카테고리 위험 판정(bug5): 단순히 'flags가 비어있지 않음'이 아니라,
  // 해당 기준의 통제 어휘(rubric.redFlags)와 매칭되는 플래그가 있고 점수가 낮을 때만 위험으로 본다.
  // (LLM 자유서술의 무해 단어로 게이트가 오발화하거나, 통제 어휘를 안 써서 무력화되는 것을 줄임)
  const redFlagsByKey = new Map(rubric.criteria.map((c) => [c.key, c.redFlags ?? []]));
  // 통제 어휘(redFlags) 단방향 포함 매칭. 빈/한 글자 토큰은 제외해 오매칭을 막는다(자체감사 A3).
  // 방향은 flag ⊇ redFlag(모델이 통제어휘를 포함하는 문구를 낸 경우)만 인정 — rf.includes(f)는
  // 빈 문자열/짧은 토큰이 모든 redFlag에 매칭되는 오발화를 유발하므로 제거한다.
  // NFC 정규화: 스크랩/LLM 한글이 NFD(자모 분리)로 와도 통제어휘와 매칭되게 한다.
  const nfc = (s: string) => s.normalize('NFC');
  const hasControlMatch = (key: string, csFlags: string[]): boolean => {
    const allowed = (redFlagsByKey.get(key) ?? []).filter((rf) => rf.trim().length >= 2).map(nfc);
    if (allowed.length === 0) return false;
    return csFlags.some((f) => {
      const t = nfc(f.trim());
      return t.length >= 2 && allowed.some((rf) => t.includes(rf));
    });
  };
  const criticalRisk = criterionScores.some((cs) => {
    const allowed = redFlagsByKey.get(cs.key) ?? [];
    // redFlags가 정의된 기준: 오직 통제 어휘 매칭일 때만 위험(점수와 무관하게 격상). 무해한 자유서술
    //   단어로는 오발화하지 않는다(bug5 의도 — prompts.ts가 모델에 통제어휘 사용을 지시함).
    // redFlags 미정의 기준: 저점수 + 의미있는(2자+) flag일 때 위험(종전 동작, 빈/짧은 토큰 제외).
    if (allowed.length > 0) return hasControlMatch(cs.key, cs.flags);
    return cs.score < 40 && cs.flags.some((f) => f.trim().length >= 2);
  });

  return {
    code: 'f',
    score,
    confidence,
    flags: criticalRisk ? [...flags, '카테고리위험'] : flags,
    rationale,
    dataInsufficient: covered === 0,
    criterionScores,
  };
}
