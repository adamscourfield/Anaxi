import { cookies, headers } from "next/headers";
import nodeCrypto from "crypto";
import {
  CSRF_COOKIE,
  CSRF_COOKIE_OPTIONS,
  CSRF_HEADER,
  createCsrfToken,
} from "@/lib/csrf-shared";

export { CSRF_COOKIE, CSRF_COOKIE_OPTIONS, CSRF_HEADER, createCsrfToken };

/** Read CSRF token (cookie is created in middleware, not in Server Components). */
export function getCsrfToken(): string {
  const fromHeader = headers().get(CSRF_HEADER);
  if (fromHeader) return fromHeader;
  return cookies().get(CSRF_COOKIE)?.value ?? "";
}

/** @deprecated Use {@link getCsrfToken}. Cookie is issued in middleware. */
export async function ensureCsrfToken(): Promise<string> {
  return getCsrfToken();
}

export function validateCsrfToken(submitted: string | null | undefined, cookieValue?: string | null): boolean {
  if (!submitted || !cookieValue) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(cookieValue);
  if (a.length !== b.length) return false;
  return nodeCrypto.timingSafeEqual(a, b);
}

export async function assertCsrfFromForm(form: FormData): Promise<void> {
  const store = cookies();
  const cookie = store.get(CSRF_COOKIE)?.value;
  const submitted = String(form.get("_csrf") ?? "");
  if (!validateCsrfToken(submitted, cookie)) {
    throw new Error("CSRF_VALIDATION_FAILED");
  }
}
