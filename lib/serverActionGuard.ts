import { headers } from "next/headers";
import { validateCsrfToken, CSRF_COOKIE } from "@/lib/csrf";
import { cookies } from "next/headers";
import { isProduction } from "@/lib/env";

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const base = process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (base) {
    try {
      hosts.add(new URL(base).host);
    } catch {
      // ignore invalid URL
    }
  }
  return hosts;
}

/**
 * CSRF / origin checks for server actions (production).
 * Validates Origin/Host against NEXTAUTH_URL and optional _csrf form field.
 */
export async function assertSafeServerAction(formData?: FormData): Promise<void> {
  if (!isProduction()) return;

  const headerList = await headers();
  const allowed = allowedHosts();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const origin = headerList.get("origin");

  if (host && allowed.size > 0 && !allowed.has(host)) {
    throw new Error("CSRF_VALIDATION_FAILED");
  }

  if (origin && allowed.size > 0) {
    try {
      if (!allowed.has(new URL(origin).host)) {
        throw new Error("CSRF_VALIDATION_FAILED");
      }
    } catch {
      throw new Error("CSRF_VALIDATION_FAILED");
    }
  }

  if (formData?.has("_csrf")) {
    const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
    const submitted = String(formData.get("_csrf") ?? "");
    if (!validateCsrfToken(submitted, cookie)) {
      throw new Error("CSRF_VALIDATION_FAILED");
    }
  }
}
