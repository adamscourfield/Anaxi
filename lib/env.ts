/** True when running a production build or NODE_ENV=production. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Returns the env var when set; in production, missing values throw at call time. */
export function requireEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value) return value;
  if (isProduction()) {
    throw new Error(`${name} must be set in production.`);
  }
  return undefined;
}
