import { test, expect } from "@playwright/test";

test.describe("public smoke", () => {
  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: /sign in|log in|anaxi/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/login/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
  });

  test("unknown public route shows branded 404", async ({ page }) => {
    await page.goto("/unknown-public-route-ux-smoke");
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
