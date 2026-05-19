import { cookies } from "next/headers";
import crypto from "crypto";

export const CSRF_COOKIE = "anaxi_csrf";

export function createCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Read or create a CSRF token (sets cookie when missing). */
export async function ensureCsrfToken(): Promise<string> {
  const store = cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

  const token = createCsrfToken();
  store.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return token;
}

export function validateCsrfToken(submitted: string | null | undefined, cookieValue?: string | null): boolean {
  if (!submitted || !cookieValue) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(cookieValue);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function assertCsrfFromForm(form: FormData): Promise<void> {
  const store = cookies();
  const cookie = store.get(CSRF_COOKIE)?.value;
  const submitted = String(form.get("_csrf") ?? "");
  if (!validateCsrfToken(submitted, cookie)) {
    throw new Error("CSRF_VALIDATION_FAILED");
  }
}
