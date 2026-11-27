import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Signs each demo account in once per test worker and reuses the session.
 *
 * Sign-in is rate limited per email (lib/loginRateLimit.ts: 10 attempts in 15 minutes), so
 * signing in afresh for every test locks the account out part-way through a run, and sooner
 * when CI retries a failed test.
 */

export const DEMO_PASSWORD = "Password123!";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
const sessions = new Map<string, StorageState>();

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
}

/** A new browser context already signed in as `email`. Close it when done. */
export async function contextAs(browser: Browser, email: string, password = DEMO_PASSWORD): Promise<BrowserContext> {
  const saved = sessions.get(email);
  if (saved) return browser.newContext({ storageState: saved });
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, password);
  await page.close();
  sessions.set(email, await context.storageState());
  return context;
}

/** A page signed in as `email`, plus a function that closes its context. */
export async function pageAs(browser: Browser, email: string, password = DEMO_PASSWORD) {
  const context = await contextAs(browser, email, password);
  const page = await context.newPage();
  return { page, close: () => context.close() };
}
