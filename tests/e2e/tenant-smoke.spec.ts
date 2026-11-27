import { test as base, expect, type Page } from "@playwright/test";
import { contextAs } from "./sessions";

const email = process.env.E2E_EMAIL || "sarah.chen@demo.school";
const password = process.env.E2E_PASSWORD || "Password123!";

// `page` is signed in once per worker and reused (sign-in is rate limited; see ./sessions).
const test = base.extend<{ page: Page }>({
  page: async ({ browser }, provide) => {
    const context = await contextAs(browser, email, password);
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

test.describe("tenant smoke (UX-150)", () => {

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
