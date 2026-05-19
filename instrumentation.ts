export async function register() {
  const { validateProductionEnv } = await import("@/lib/startupEnv");
  validateProductionEnv();

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    await import("./sentry.edge.config");
  }
}
