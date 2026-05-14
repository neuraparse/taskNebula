/**
 * Next.js 15 instrumentation entry point — registers the OpenTelemetry SDK
 * on the Node.js runtime so server requests, AI engine calls, and outbound
 * HTTP requests emit spans to an OTLP collector (SigNoz, Grafana Tempo,
 * Honeycomb, Jaeger, etc.).
 *
 * Activation
 * ----------
 * Setting `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. http://signoz-otel-collector:4318)
 * is the single switch. With it unset, this module is a no-op so local dev
 * and CI keep running without an OTLP collector.
 *
 * Sentry forwarding
 * -----------------
 * `onRequestError` is exported per the Next 15 contract — Next calls it
 * whenever a server-side error escapes a Route Handler / RSC. We dynamically
 * import @sentry/nextjs so the bundle stays slim when Sentry is not wired up.
 *
 * Roadmap reference: OBS-35 (Langfuse + OpenTelemetry).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!otlpEndpoint) {
    // No collector configured — keep the runtime cost at zero.
    return;
  }

  try {
    const { registerOTel } = await import('@vercel/otel');
    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME || 'tasknebula-web',
    });
  } catch (err) {
    // Failing to register OTel must not crash the server boot. Log and
    // continue so the rest of the app keeps working.
    // eslint-disable-next-line no-console
    console.warn('[instrumentation] OTel registration failed:', err);
  }
}

/**
 * Next.js 15 calls this hook for every uncaught server-side error.
 * Forward it to Sentry (when the SDK is installed and DSN configured).
 *
 * The dynamic import means installs without `@sentry/nextjs` still build.
 */
export async function onRequestError(
  error: unknown,
  request: {
    path?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }
  try {
    const Sentry = await import('@sentry/nextjs').catch(() => null);
    if (!Sentry) return;
    // Cast: Sentry's RequestInfo requires `path` to be defined; we accept
    // partial info from Next.js and let Sentry coerce.
    Sentry.captureRequestError(error, request as Parameters<typeof Sentry.captureRequestError>[1], context);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[instrumentation] Failed to forward error to Sentry:', err);
  }
}
