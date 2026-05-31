import type { Taxonomy, TaxonomyNode } from './types';

let cached: Taxonomy | null = null;

/**
 * 노드별 criteria weight를 0~1 스케일·합 1로 정규화한다.
 * data/taxonomy.json 일부 부서(health/food 등 7개)가 0~1 계약을 어기는 정수 가중치(2~5)로
 * 작성돼 있어, prioritize/aggregateCategory의 가중합을 왜곡한다. 로드 시 1회 정규화해
 * 소스 스케일과 무관하게 항상 0~1 상대가중치를 보장한다(이미 정규화된 노드는 사실상 불변).
 */
function normalizeNodeWeights(nodes: TaxonomyNode[]): { nodes: TaxonomyNode[]; fixed: number } {
  let fixed = 0;
  const out = nodes.map((n) => {
    const crit = n.criteria ?? [];
    const weights = crit.map((c) => (typeof c.weight === 'number' && c.weight > 0 ? c.weight : 0));
    const sum = weights.reduce((a, w) => a + w, 0);
    // 이미 합이 ~1이고 모든 weight가 0~1이면 그대로 둔다.
    const inRange = crit.every((c) => typeof c.weight === 'number' && c.weight >= 0 && c.weight <= 1);
    if (sum > 0 && inRange && Math.abs(sum - 1) <= 0.05) return n;
    if (sum <= 0) {
      // 전부 0/누락 → 균등 분배(평가가 항상 가중치를 갖도록)
      const eq = crit.length > 0 ? Math.round((1 / crit.length) * 1000) / 1000 : 0;
      if (crit.length > 0) fixed++;
      return { ...n, criteria: crit.map((c) => ({ ...c, weight: eq })) };
    }
    fixed++;
    return {
      ...n,
      criteria: crit.map((c, i) => ({
        ...c,
        weight: Math.round((weights[i] / sum) * 1000) / 1000,
      })),
    };
  });
  return { nodes: out, fixed };
}

/** data/taxonomy.json 로드(서버 전용, 1회 캐시). 파일이 없으면 빈 택소노미. */
export async function loadTaxonomy(): Promise<Taxonomy> {
  if (cached) return cached;
  try {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', 'taxonomy.json');
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Taxonomy;
    // 가중치 스케일을 정규화해 손상된 데이터가 랭킹을 오염시키지 못하게 한다.
    const { nodes, fixed } = normalizeNodeWeights(parsed.nodes ?? []);
    if (fixed > 0) {
      console.warn(`[taxonomy] ${fixed}개 노드의 criteria weight를 0~1·합1로 정규화함(소스 스케일 보정).`);
    }
    // 성공 시에만 캐시한다.
    cached = { ...parsed, nodes };
    return cached;
  } catch {
    // 실패 결과는 캐시하지 않는다. 다음 호출에서 재시도 가능하도록
    // fresh 빈 택소노미를 반환만 한다.
    return { version: 'empty', nodes: [] };
  }
}

/** 테스트용 주입 */
export function setTaxonomyForTest(tax: Taxonomy | null): void {
  cached = tax;
}
