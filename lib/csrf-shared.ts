/** Edge-safe CSRF constants and token generation (no Node.js `crypto` or `next/headers`). */

export const CSRF_COOKIE = "anaxi_csrf";
/** Set by middleware so Server Components can read the token on the same request. */
export const CSRF_HEADER = "x-csrf-token";

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

export function createCsrfToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
