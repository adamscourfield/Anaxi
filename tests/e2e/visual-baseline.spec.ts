import { test, expect } from "@playwright/test";

/**
 * Optional visual baselines (UX-151). Run locally after demo seed:
 *   npm run seed:demo && npx playwright test visual-baseline --update-snapshots
 */
test.describe("Visual baselines @visual", () => {
  test.skip(!process.env.VISUAL_BASELINE, "Set VISUAL_BASELINE=1 to run screenshot comparisons");

  test.beforeEach(async ({ page }) => {
    // Auth handled by project config / storageState when configured
    await page.goto("/login");
  });

  test("login page", async ({ page }) => {
    await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  });
});
