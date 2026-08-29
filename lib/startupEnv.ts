import { isProduction } from "@/lib/env";

const PRODUCTION_REQUIRED = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
] as const;

const PRODUCTION_RECOMMENDED = ["RESEND_WEBHOOK_SECRET", "IMPORT_S3_BUCKET"] as const;

/** Validates required environment variables at process startup (production only). */
export function validateProductionEnv(): void {
  if (!isProduction()) return;

  const missing = PRODUCTION_REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }

  const recommended = PRODUCTION_RECOMMENDED.filter((name) => !process.env[name]?.trim());
  if (recommended.length) {
    console.warn(
      `[startup] Recommended production variables not set: ${recommended.join(", ")}`,
    );
  }
}
