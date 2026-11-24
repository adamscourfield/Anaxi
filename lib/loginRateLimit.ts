import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Limits password guessing. Applied by every endpoint that checks a password
 * (the school lookup at /api/auth/tenants and the NextAuth credentials sign-in),
 * each with its own counters:
 *  - per IP: stops one machine hammering many accounts;
 *  - per email: stops many machines (rotating IPs) hammering one account.
 */
export const LOGIN_LIMITS = {
  perIp: { max: 30, windowMs: 60_000 },
  perEmail: { max: 10, windowMs: 15 * 60_000 },
};

export type LoginRateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkLoginRateLimit(scope: string, ip: string, email: string): Promise<LoginRateLimitResult> {
  const byIp = await checkRateLimit(`${scope}:ip:${ip}`, LOGIN_LIMITS.perIp);
  if (!byIp.allowed) return { allowed: false, retryAfterSec: byIp.retryAfterSec ?? 60 };
  const byEmail = await checkRateLimit(`${scope}:email:${email.toLowerCase().trim()}`, LOGIN_LIMITS.perEmail);
  if (!byEmail.allowed) return { allowed: false, retryAfterSec: byEmail.retryAfterSec ?? 900 };
  return { allowed: true };
}

/** Client IP from a header record (NextAuth hands authorize() plain headers, not a Request). */
export function ipFromHeaders(headers: Record<string, string | string[] | undefined> | undefined): string {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const forwarded = pick(headers?.["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return pick(headers?.["x-real-ip"]) || "unknown";
}
