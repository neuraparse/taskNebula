# Observability

TaskNebula ships with hooks for an end-to-end self-hostable observability
stack. This document explains how each layer plugs in, what to expect when
it is *not* configured, and the recommended tier matrix.

Reference: roadmap task **OBS-35** (Langfuse + OpenTelemetry).

## Layers at a glance

| Layer            | Tool                                      | Activation env                                                  | Default |
|------------------|-------------------------------------------|------------------------------------------------------------------|---------|
| Error tracking   | Sentry (cloud or self-host)               | `SENTRY_DSN` (server) / `NEXT_PUBLIC_SENTRY_DSN` (browser)       | off     |
| LLM tracing      | Langfuse (cloud or self-host)             | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`    | off     |
| Distributed trace| OpenTelemetry → SigNoz / Grafana Tempo    | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`               | off     |
| DB query stats   | `pg_stat_statements` + pgHero / pganalyze | shipped on by default in `docker-compose.yml`                    | **on**  |
| Realtime (RTC)   | LiveKit Prometheus exporter               | `LIVEKIT_PROMETHEUS_PORT` (set to a free port, e.g. `6789`)      | off     |

When an env var is unset the matching code path is a no-op — TaskNebula has
no observability dependencies in dev / CI.

## OpenTelemetry

The Next.js app loads `instrumentation.ts` on Node-runtime boot and registers
the `@vercel/otel` SDK. Spans are exported via the OTLP HTTP exporter built
into the SDK.

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
OTEL_SERVICE_NAME=tasknebula-web
# Optional standard OTel knobs:
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=...
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=prod
```

The same file exports `onRequestError` which Next.js 15 invokes whenever a
server-side error escapes a route handler / RSC. We forward the error to
Sentry via `@sentry/nextjs` so unhandled exceptions show up in the existing
issue triage workflow.

### LLM trace correlation

`apps/web/src/lib/ai/observability/langfuse.ts#traceLlmCall` reads the active
OTel span context and attaches `otelTraceId` / `otelSpanId` to the Langfuse
trace metadata. With both tools open you can copy the trace id out of
SigNoz / Tempo and search Langfuse for the matching LLM call.

## Langfuse

Configure with:

```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com   # or your self-host URL
```

Every call to `draftIssue()` / `draftIssuesMulti()` ends with `traceLlmCall()`
which records the prompt, response, latency, and provider. Native (heuristic)
runs are *not* traced — they're not LLM calls.

To trace a new AI feature, import the helper and call it once per generation:

```ts
import { traceLlmCall } from '@/lib/ai/observability/langfuse';

const started = Date.now();
const result = await myLlmCall();
await traceLlmCall({
  feature: 'sprint.summary',
  provider: 'openai',
  model: 'gpt-4o-mini',
  input: { prompt },
  output: result,
  latencyMs: Date.now() - started,
});
```

## Sentry

Sentry already has two integration surfaces:

1. **OAuth + webhook** — for ingesting Sentry issues into TaskNebula
   (commit `1ea6f14`). Configured under Admin → Integrations.
2. **Error capture** — the new `instrumentation.ts#onRequestError` hook ships
   server errors back to Sentry. To enable, install `@sentry/nextjs`
   (already in `package.json`) and set `SENTRY_DSN`.

For client-side errors create `apps/web/sentry.client.config.ts` per the
Sentry Next.js docs.

## Postgres — `pg_stat_statements`

Loaded at server start via `docker-compose.yml`:

```yaml
command:
  - postgres
  - -c
  - shared_preload_libraries=pg_stat_statements
  - -c
  - pg_stat_statements.track=all
  - -c
  - pg_stat_statements.max=10000
```

`docker/postgres/init.sql` then runs `CREATE EXTENSION IF NOT EXISTS
pg_stat_statements` on first boot. Verify with:

```sql
SELECT count(*) FROM pg_stat_statements;
SELECT query, calls, total_exec_time, mean_exec_time
  FROM pg_stat_statements
 ORDER BY total_exec_time DESC
 LIMIT 20;
```

### Visualizers

* **pgHero** (open source, self-host) — drop-in Docker container that reads
  `pg_stat_statements`:
  ```bash
  docker run -d --name pghero \
    -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/tasknebula \
    -p 8080:8080 ankane/pghero
  ```
  Add as a service in your prod compose file behind your internal-only network.

* **pganalyze** (SaaS, commercial) — install the collector container and
  point it at the same DATABASE_URL. Better long-term retention + EXPLAIN
  capture, paid.

## LiveKit Prometheus

LiveKit exposes a `/metrics` endpoint when `prometheus_port` is set. Toggle
via env:

```env
LIVEKIT_PROMETHEUS_PORT=6789
```

`docker/livekit/start-livekit.sh` emits the `prometheus_port:` block when the
var is set to a non-zero value. Because the LiveKit container uses
`network_mode: host`, the metrics endpoint is reachable on the host at
`http://<host>:6789/metrics`.

Add a scrape target to your Prometheus / SigNoz collector config:

```yaml
scrape_configs:
  - job_name: 'livekit'
    static_configs:
      - targets: ['host.docker.internal:6789']
```

Key series to alert on: `livekit_room_participants`, `livekit_packets_lost`,
`livekit_node_cpu_load`.

## Tier matrix

| Need                              | Minimum                                          | Recommended                                                                                | Ideal                                                                                                  |
|----------------------------------|--------------------------------------------------|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Error tracking                    | server `console.error` + container logs          | Sentry (cloud)                                                                             | Sentry (self-host) + Slack/PagerDuty routing                                                           |
| LLM cost & latency                | none                                             | Langfuse cloud                                                                             | Langfuse self-host on the same cluster as the DB                                                       |
| Request tracing                   | Next.js access logs                              | SigNoz single-node                                                                         | SigNoz / Grafana LGTM (Loki + Grafana + Tempo + Mimir) cluster                                         |
| Postgres performance              | `pg_stat_statements` + ad-hoc psql               | pgHero                                                                                     | pganalyze + EXPLAIN insights                                                                           |
| LiveKit / RTC                     | container logs                                   | Prometheus exporter + Grafana LiveKit dashboard                                            | Exporter + per-room recording + p99 packet-loss alerts                                                 |
| Uptime                            | none                                             | Healthchecks.io ping on `/api/health`                                                      | Synthetic monitoring (Checkly, Grafana Synthetic) per critical user flow                               |

### Recommended self-host stack (single VM)

For a single-VM hobby / small-team deployment we suggest:

1. **Sentry** (cloud) — free for individuals.
2. **Langfuse** cloud — free tier covers small workloads.
3. **SigNoz** single-node Docker — OpenTelemetry + APM + logs in one UI.
4. **pgHero** in the existing docker-compose network — `pg_stat_statements`
   is already on by default thanks to OBS-35.
5. **LiveKit Prometheus** exporter scraped by SigNoz collector.

## Verifying after enabling

After setting envs, restart the web container and run:

```bash
# OTel
curl -fsS http://localhost:3000/api/health
# expect a span in your collector within ~30s

# Langfuse
# make an AI call (Settings → AI & Agents → "Try draft issue")
# expect a generation in the Langfuse UI within ~30s

# pg_stat_statements
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_statements;"

# LiveKit
curl -fsS http://localhost:${LIVEKIT_PROMETHEUS_PORT:-6789}/metrics | head
```

If any of those fail, check the container logs — every layer's failure mode
is "log a warning and continue", so TaskNebula will keep serving traffic
even when telemetry is broken.
