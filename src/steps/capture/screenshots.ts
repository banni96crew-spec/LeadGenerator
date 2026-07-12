import type { Page } from "playwright";

const COOKIE_SELECTORS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  ".cookie-accept",
  'button:has-text("Accept")',
  'button:has-text("Принять")',
  'button:has-text("Согласен")',
  'button:has-text("OK")',
];

export async function dismissCookieBanners(page: Page): Promise<void> {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 1000 });
      }
    } catch {
      // best-effort
    }
  }
}

export async function preparePage(page: Page, attempt: number): Promise<void> {
  await page.waitForSelector("body", { timeout: 15_000 });
  await dismissCookieBanners(page);
  const extraWait = attempt > 0 ? 1000 * attempt : 0;
  if (extraWait > 0) {
    await page.waitForTimeout(extraWait);
  }
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}
