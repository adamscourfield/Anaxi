import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL || "sarah.chen@demo.school";
const password = process.env.E2E_PASSWORD || "Password123!";

test.describe("authenticated flows", () => {
  test("teacher can sign in and reach home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(home|leave|observe)/, { timeout: 30_000 });
    await expect(page.getByText(/home|dashboard|welcome/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("authenticated user sees notification bell", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    await expect(page.getByRole("button", { name: /notifications/i })).toBeVisible();
  });
});
