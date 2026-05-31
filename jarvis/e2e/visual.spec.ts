// e2e/visual.spec.ts
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const MODES = ["idle", "listening", "thinking", "speaking"] as const;

test("상태별 비주얼 스크린샷", async ({ page }) => {
  // Ensure screenshot directory exists
  await mkdir(join(process.cwd(), "e2e/__screens__"), { recursive: true });

  await page.goto("/");
  // Canvas가 한 프레임 이상 렌더되도록 대기
  await page.waitForTimeout(1500);
  for (const mode of MODES) {
    await page.evaluate((m) => (window as any).__jarvis?.setMode(m), mode);
    await page.waitForTimeout(1600); // 색 전이가 수렴하도록(프레임 독립 lerp ~1s)
    await page.screenshot({ path: `e2e/__screens__/${mode}.png` });
  }
  // 캔버스 존재 확인
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
});
