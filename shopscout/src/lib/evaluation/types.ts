import { z } from 'zod';

// 주의: 이 스키마는 toStrictJsonSchema(z.toJSONSchema)를 거쳐 Agent SDK/API의 json_schema 출력에
// 그대로 쓰인다. 따라서 .transform()/.coerce 등 JSON Schema로 표현 불가한 변환을 쓰면 안 된다
// (쓰면 "Transforms cannot be represented in JSON Schema"로 모든 평가 호출이 죽는다 — bug4 회귀).
// 실 LLM 출력의 사소한 일탈(문자열 숫자·퍼센트 confidence·범위 이탈)은 team.ts의 toFactor
// (clampScore/normConfidence)와 aggregateCategory의 후처리에서 보정한다.
export const factorSchema = z.object({
  code: z.string().optional(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()).default([]),
  rationale: z.string().default(''),
  /** 분석에 필요한 데이터가 입력에 없어 근거 없이 채점했음 */
  dataInsufficient: z.boolean().optional(),
  /** 목적 적합성(ⓔ) 전용 */
  mustHaveMet: z.boolean().optional(),
  dealbreakerHit: z.boolean().optional(),
});

export type FactorSchema = z.infer<typeof factorSchema>;

/** 카테고리(ⓕ) 기준별 점수 스키마 (병합 평가용) */
export const criterionScoreSchema = z.object({
  key: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  dataInsufficient: z.boolean().optional(),
  flags: z.array(z.string()).default([]),
});

/**
 * 6요소를 한 번에 받는 병합 평가 스키마 (R8: 매물당 LLM 호출 6→1).
 * a~e를 optional로 둬, 한 요소가 통째로 누락돼도 그 요소만 infraFailFactor로 격리하고
 * 나머지 요소는 살린다(병합 평가 all-or-nothing 붕괴 방지, bug4).
 */
export const mergedEvalSchema = z.object({
  a: factorSchema.optional(),
  b: factorSchema.optional(),
  c: factorSchema.optional(),
  d: factorSchema.optional(),
  e: factorSchema.optional(), // mustHaveMet/dealbreakerHit 포함(factorSchema에 optional로 존재)
  f: z.object({ criterionScores: z.array(criterionScoreSchema).default([]), rationale: z.string().default('') }).optional(),
});
export type MergedEval = z.infer<typeof mergedEvalSchema>;

/**
 * 위험 플래그 키워드 — 하나라도 매칭되면 신뢰 임계 통과 실패.
 * 실 LLM이 통제 어휘 대신 동의 표현(모조품/위조/비정품/낚시 등)을 쓰는 경우까지 포괄한다(bug17).
 */
export const RED_FLAG = /미끼가의심|미끼가|낚시|허위|도용|가품|짝퉁|모조|위조|비정품|정품\s*아님|사양불일치/;

export const TRUST_THRESHOLD = 50;
