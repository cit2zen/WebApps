import type { CriterionDef, ResolvedRubric, Taxonomy, TaxonomyNode } from './types';

/** id로 노드 인덱스 구축 */
export function indexNodes(tax: Taxonomy): Map<string, TaxonomyNode> {
  return new Map(tax.nodes.map((n) => [n.id, n]));
}

/** 조상 체인을 따라 기준을 병합한다(부모 먼저, 자식이 같은 key를 덮어씀). */
export function resolveRubric(tax: Taxonomy, nodeId: string): ResolvedRubric | null {
  const index = indexNodes(tax);
  const target = index.get(nodeId);
  if (!target) return null;

  // 조상 체인 수집 (root 제외), 루트→리프 순으로
  const chain: TaxonomyNode[] = [];
  let cur: TaxonomyNode | undefined = target;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent && cur.parent !== 'root' ? index.get(cur.parent) : undefined;
  }

  const merged = new Map<string, CriterionDef>();
  const hints = new Set<string>();
  for (const node of chain) {
    for (const c of node.criteria) merged.set(c.key, c);
    for (const h of node.scrapeHints) hints.add(h);
  }

  return {
    nodeId: target.id,
    nodeName: target.name,
    criteria: [...merged.values()],
    scrapeHints: [...hints],
    dynamic: false,
  };
}
