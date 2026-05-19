import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL || "sarah.chen@demo.school";
const password = process.env.E2E_PASSWORD || "Password123!";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test.describe("tenant smoke (UX-150)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("home loads with main landmark", async ({ page }) => {
    await page.goto("/home");
    await expect(page.locator("#tenant-main")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("my-actions loads", async ({ page }) => {
    await page.goto("/my-actions");
    await expect(page.getByRole("heading", { name: /my actions/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("explorer loads with main landmark", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.locator("#tenant-main")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("admin loads with main landmark", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("#tenant-main")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("meetings/actions redirects to my-actions", async ({ page }) => {
    await page.goto("/meetings/actions");
    await expect(page).toHaveURL(/\/my-actions/, { timeout: 15_000 });
  });

  test("global 404 is branded", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-ux-smoke");
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
