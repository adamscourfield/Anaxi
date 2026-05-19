import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

/** Report errors to structured logs and Sentry when configured. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  logger.error("capture.exception", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...context,
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  logger.info("capture.message", { message, ...context });

  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, { extra: context });
  }
}
