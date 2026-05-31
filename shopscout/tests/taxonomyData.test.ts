import { describe, it, expect, beforeEach } from 'vitest';
import { loadTaxonomy, setTaxonomyForTest } from '@/lib/taxonomy/loader';
import { resolveRubric, indexNodes } from '@/lib/taxonomy/resolver';

beforeEach(() => setTaxonomyForTest(null)); // 캐시 초기화하여 실제 파일 로드

describe('실제 data/taxonomy.json', () => {
  it('충분한 부서·품목과 기준을 갖는다', async () => {
    const tax = await loadTaxonomy();
    expect(tax.nodes.length).toBeGreaterThan(100);
    const depts = tax.nodes.filter((n) => n.parent === 'root');
    expect(depts.length).toBeGreaterThanOrEqual(10);
    // 모든 노드가 1개 이상의 기준을 가진다
    expect(tax.nodes.every((n) => n.criteria.length >= 1)).toBe(true);
  });

  it('모든 기준 weight가 0~1로 정규화되고 노드별 합이 ~1이다(스케일 손상 방지)', async () => {
    const tax = await loadTaxonomy();
    for (const n of tax.nodes) {
      for (const c of n.criteria) {
        expect(c.weight).toBeGreaterThanOrEqual(0);
        expect(c.weight).toBeLessThanOrEqual(1);
      }
      const sum = n.criteria.reduce((a, c) => a + c.weight, 0);
      // 로드 시 정규화되므로 노드별 합은 1에 매우 가까워야 한다(반올림 오차 허용).
      expect(Math.abs(sum - 1)).toBeLessThan(0.05);
    }
  });

  it('리프 노드가 부서 기준을 상속한다', async () => {
    const tax = await loadTaxonomy();
    const index = indexNodes(tax);
    // 부모가 root가 아닌(=리프) 노드 하나를 골라 상속 검증
    const leaf = tax.nodes.find((n) => n.parent && n.parent !== 'root' && index.has(n.parent));
    expect(leaf).toBeTruthy();
    const r = resolveRubric(tax, leaf!.id)!;
    const parent = index.get(leaf!.parent!)!;
    // 병합 기준 수 >= 리프 자체 기준 수 (부모 것이 더해짐)
    expect(r.criteria.length).toBeGreaterThanOrEqual(leaf!.criteria.length);
    // 부모의 첫 기준 key가 병합 결과에 포함
    if (parent.criteria.length > 0) {
      const parentKeys = parent.criteria.map((c) => c.key);
      const mergedKeys = r.criteria.map((c) => c.key);
      expect(parentKeys.some((k) => mergedKeys.includes(k))).toBe(true);
    }
  });
});
