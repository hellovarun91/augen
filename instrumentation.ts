// Next.js calls this on server start. We use it to register Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
    await import("./sentry.server.config");
  }
}
