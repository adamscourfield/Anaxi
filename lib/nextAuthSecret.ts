/**
 * Resolves NEXTAUTH_SECRET. In production, missing secret is a hard error.
 * Development may use a fixed fallback for local convenience only.
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET must be set in production. Refusing to start with an insecure default."
    );
  }

  return "dev-insecure-nextauth-secret";
}
