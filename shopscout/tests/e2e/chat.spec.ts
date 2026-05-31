import { test, expect } from '@playwright/test';

test('발화 → 추천 카드까지 (목 LLM·목 소스)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ShopScout/ })).toBeVisible();

  await page.getByPlaceholder(/무엇을 찾으세요/).fill('코딩용 무선 키보드 10만원');
  await page.getByRole('button', { name: '보내기' }).click();

  // 추천 카드가 렌더된다
  await expect(page.getByText('상품 보기 →').first()).toBeVisible({ timeout: 30_000 });

  // E2: 추천 요약이 보인다
  await expect(page.getByText(/💡/)).toBeVisible();

  // E3: 비교표 토글이 동작한다 (서로 다른 상품 3종이므로 비교표 노출)
  await page.getByRole('button', { name: '비교표' }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('E4: 새로고침 후 직전 추천이 복원된다', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/무엇을 찾으세요/).fill('코딩용 무선 키보드 10만원');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText(/💡/)).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByText('이전 대화에서 추천한 내용이에요.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/💡/)).toBeVisible();
});

test('새 대화 버튼이 화면을 초기화한다', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/무엇을 찾으세요/).fill('코딩용 무선 키보드 10만원');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText(/💡/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '새 대화' }).click();
  await expect(page.getByText(/💡/)).toHaveCount(0);
});

test('빈 입력은 전송되지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('찾는 중')).toHaveCount(0);
});
