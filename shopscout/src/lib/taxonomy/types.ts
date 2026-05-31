/** 품목별 평가 기준 1개 */
export interface CriterionDef {
  key: string;
  label: string;
  check: string; // 평가자에게 주는 구체 지시
  dataNeeded: string[];
  weight: number; // 0~1 상대 가중치
  redFlags: string[];
}

/** 택소노미 노드 (점 경로 id로 계층 표현: "food.supplement") */
export interface TaxonomyNode {
  id: string;
  name: string;
  parent?: string; // 부서 노드는 "root"
  keywords: string[];
  scrapeHints: string[];
  criteria: CriterionDef[];
}

export interface Taxonomy {
  version: string;
  nodes: TaxonomyNode[];
}

/** 분류 결과로 해결된 평가 루브릭 */
export interface ResolvedRubric {
  nodeId: string;
  nodeName: string;
  criteria: CriterionDef[];
  scrapeHints: string[];
  /** 동적 생성(택소노미 미수록)으로 만들어졌는지 */
  dynamic: boolean;
}
