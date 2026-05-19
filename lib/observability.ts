import { logger } from "@/lib/logger";

/** Report errors to logs; wire Sentry in production via your hosting provider if needed. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  logger.error("capture.exception", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...context,
  });
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  logger.info("capture.message", { message, ...context });
}
