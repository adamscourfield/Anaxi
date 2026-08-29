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
 * Validates Origin against the request's own Host (so the app can be reachable on more
 * than one domain, e.g. an apex + www alias, without a fixed NEXTAUTH_URL causing false
 * failures), falling back to an allow-list of configured hosts when Origin is absent.
 */
export async function assertSafeServerAction(formData?: FormData): Promise<void> {
  if (!isProduction()) return;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const origin = headerList.get("origin");

  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) {
        throw new Error("CSRF_VALIDATION_FAILED");
      }
    } catch {
      throw new Error("CSRF_VALIDATION_FAILED");
    }
  } else {
    const allowed = allowedHosts();
    if (host && allowed.size > 0 && !allowed.has(host)) {
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
