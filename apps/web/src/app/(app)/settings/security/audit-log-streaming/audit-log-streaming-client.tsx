'use client';

/**
 * Audit log streaming — client UI.
 *
 * Renders the list of configured sinks for the workspace, an "Add sink" form,
 * and a per-row "Test" button that fires a synthetic delivery and surfaces
 * the outcome inline.
 *
 * Talks to:
 *   GET    /api/admin/audit-log-sinks?organizationId=...
 *   POST   /api/admin/audit-log-sinks
 *   PATCH  /api/admin/audit-log-sinks/:sinkId
 *   DELETE /api/admin/audit-log-sinks/:sinkId
 *   POST   /api/admin/audit-log-sinks/:sinkId/test
 *
 * Secrets are never returned by GET; the signing secret is shown exactly
 * once when a sink is first created.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

type SinkType = 'webhook' | 'splunk_hec' | 'datadog' | 's3';

interface Sink {
  id: string;
  type: SinkType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastError: string | null;
  successCount: string;
  failureCount: string;
  createdAt: string;
}

interface CreateForm {
  type: SinkType;
  name: string;
  // Stringified JSON so the user can paste type-specific config.
  configJson: string;
}

const DEFAULT_CONFIG_FOR_TYPE: Record<SinkType, string> = {
  webhook: JSON.stringify({ url: 'https://siem.example.com/ingest' }, null, 2),
  splunk_hec: JSON.stringify(
    {
      url: 'https://splunk.example.com:8088/services/collector',
      token: 'YOUR_SPLUNK_HEC_TOKEN',
      index: 'main',
    },
    null,
    2
  ),
  datadog: JSON.stringify(
    { apiKey: 'YOUR_DATADOG_API_KEY', site: 'datadoghq.com' },
    null,
    2
  ),
  s3: JSON.stringify(
    { bucket: 'tasknebula-audit', region: 'us-east-1', prefix: 'audit' },
    null,
    2
  ),
};

const TYPE_LABEL: Record<SinkType, string> = {
  webhook: 'Generic webhook (HMAC)',
  splunk_hec: 'Splunk HEC',
  datadog: 'Datadog Logs',
  s3: 'AWS S3 (JSONL)',
};

export function AuditLogStreamingClient({
  organizationId,
}: {
  organizationId: string;
}) {
  const [sinks, setSinks] = useState<Sink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    type: 'webhook',
    name: '',
    configJson: DEFAULT_CONFIG_FOR_TYPE.webhook,
  });
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{
    sinkId: string;
    signingSecret: string;
  } | null>(null);

  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/audit-log-sinks?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { sinks: Sink[] };
      setSinks(data.sinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sinks');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      setError(null);
      try {
        let parsedConfig: Record<string, unknown>;
        try {
          parsedConfig = JSON.parse(form.configJson);
        } catch {
          throw new Error('Config is not valid JSON');
        }
        const res = await fetch('/api/admin/audit-log-sinks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            type: form.type,
            name: form.name.trim(),
            config: parsedConfig,
            enabled: true,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const { sink } = (await res.json()) as {
          sink: Sink & { signingSecret: string };
        };
        setRevealedSecret({ sinkId: sink.id, signingSecret: sink.signingSecret });
        setShowForm(false);
        setForm({
          type: 'webhook',
          name: '',
          configJson: DEFAULT_CONFIG_FOR_TYPE.webhook,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create sink');
      } finally {
        setCreating(false);
      }
    },
    [form, organizationId, refresh]
  );

  const handleToggle = useCallback(
    async (sink: Sink) => {
      try {
        await fetch(`/api/admin/audit-log-sinks/${sink.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !sink.enabled }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update sink');
      }
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (sink: Sink) => {
      if (!window.confirm(`Delete sink "${sink.name}"?`)) return;
      try {
        await fetch(`/api/admin/audit-log-sinks/${sink.id}`, {
          method: 'DELETE',
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete sink');
      }
    },
    [refresh]
  );

  const handleTest = useCallback(async (sink: Sink) => {
    setTestResults((prev) => ({
      ...prev,
      [sink.id]: { ok: false, message: 'Testing…' },
    }));
    try {
      const res = await fetch(
        `/api/admin/audit-log-sinks/${sink.id}/test`,
        { method: 'POST' }
      );
      const data = (await res.json()) as {
        result?: { ok: boolean; statusCode: number | null; error: string | null };
        error?: string;
      };
      if (data.result) {
        setTestResults((prev) => ({
          ...prev,
          [sink.id]: data.result!.ok
            ? {
                ok: true,
                message: `OK (HTTP ${data.result!.statusCode ?? '?'})`,
              }
            : {
                ok: false,
                message: data.result!.error || `HTTP ${data.result!.statusCode}`,
              },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [sink.id]: { ok: false, message: data.error || 'Test failed' },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [sink.id]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Test failed',
        },
      }));
    }
  }, []);

  const typeOptions = useMemo(
    () =>
      (Object.keys(TYPE_LABEL) as SinkType[]).map((t) => ({
        value: t,
        label: TYPE_LABEL[t],
      })),
    []
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {revealedSecret ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">
            Signing secret (shown once — copy it now)
          </p>
          <code className="mt-2 block break-all rounded bg-background px-3 py-2 font-mono text-xs">
            {revealedSecret.signingSecret}
          </code>
          <button
            type="button"
            className="mt-3 text-xs text-muted-foreground underline"
            onClick={() => setRevealedSecret(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading sinks…'
            : `${sinks.length} sink${sinks.length === 1 ? '' : 's'} configured.`}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'Add sink'}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Splunk prod"
                required
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Type</span>
              <select
                value={form.type}
                onChange={(e) => {
                  const next = e.target.value as SinkType;
                  setForm((f) => ({
                    ...f,
                    type: next,
                    configJson: DEFAULT_CONFIG_FOR_TYPE[next],
                  }));
                }}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Config (JSON)</span>
            <textarea
              value={form.configJson}
              onChange={(e) =>
                setForm((f) => ({ ...f, configJson: e.target.value }))
              }
              rows={8}
              className="rounded-md border bg-background px-3 py-2 font-mono text-xs"
            />
            <span className="text-xs text-muted-foreground">
              {form.type === 'webhook'
                ? 'Set { url }. HMAC signature uses the generated signing secret.'
                : null}
              {form.type === 'splunk_hec'
                ? 'Set { url, token, index? }.'
                : null}
              {form.type === 'datadog' ? 'Set { apiKey, site? }.' : null}
              {form.type === 's3'
                ? 'Set { bucket, region, prefix? }. AWS_ACCESS_KEY_ID/SECRET must be set in env.'
                : null}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create sink'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {sinks.map((sink) => (
          <div
            key={sink.id}
            className="rounded-lg border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">{sink.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {TYPE_LABEL[sink.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      sink.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {sink.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(sink.createdAt).toLocaleDateString()} ·
                  ✓ {sink.successCount} · ✗ {sink.failureCount}
                  {sink.lastDeliveryAt
                    ? ` · last ${new Date(sink.lastDeliveryAt).toLocaleString()}`
                    : ''}
                </p>
                {sink.lastError ? (
                  <p className="mt-1 text-xs text-destructive">
                    Last error: {sink.lastError}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(sink)}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted/40"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(sink)}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted/40"
                >
                  {sink.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sink)}
                  className="inline-flex h-8 items-center rounded-md border border-destructive/30 px-3 text-xs text-destructive hover:bg-destructive/5"
                >
                  Delete
                </button>
              </div>
            </div>
            {(() => {
              const tr = testResults[sink.id];
              if (!tr) return null;
              return (
                <p
                  className={`mt-3 text-xs ${
                    tr.ok
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive'
                  }`}
                >
                  Test: {tr.message}
                </p>
              );
            })()}
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Config</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-[11px]">
                {JSON.stringify(sink.config, null, 2)}
              </pre>
            </details>
          </div>
        ))}
        {!loading && sinks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sinks yet. Click <strong>Add sink</strong> to forward audit
            events to a SIEM.
          </div>
        ) : null}
      </div>
    </div>
  );
}
