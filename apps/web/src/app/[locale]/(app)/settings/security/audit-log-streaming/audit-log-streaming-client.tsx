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
import { useTranslations } from 'next-intl';

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
  datadog: JSON.stringify({ apiKey: 'YOUR_DATADOG_API_KEY', site: 'datadoghq.com' }, null, 2),
  s3: JSON.stringify({ bucket: 'tasknebula-audit', region: 'us-east-1', prefix: 'audit' }, null, 2),
};

const SINK_TYPES: SinkType[] = ['webhook', 'splunk_hec', 'datadog', 's3'];

export function AuditLogStreamingClient({ organizationId }: { organizationId: string }) {
  const t = useTranslations('settingsClients');
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

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>(
    {}
  );

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
      setError(err instanceof Error ? err.message : t('audit.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

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
          throw new Error(t('audit.invalidJson'));
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
        setError(err instanceof Error ? err.message : t('audit.createFailed'));
      } finally {
        setCreating(false);
      }
    },
    [form, organizationId, refresh, t]
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
        setError(err instanceof Error ? err.message : t('audit.toggleFailed'));
      }
    },
    [refresh, t]
  );

  const handleDelete = useCallback(
    async (sink: Sink) => {
      if (!window.confirm(t('audit.deleteConfirm', { name: sink.name }))) return;
      try {
        await fetch(`/api/admin/audit-log-sinks/${sink.id}`, {
          method: 'DELETE',
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('audit.deleteFailed'));
      }
    },
    [refresh, t]
  );

  const handleTest = useCallback(
    async (sink: Sink) => {
      setTestResults((prev) => ({
        ...prev,
        [sink.id]: { ok: false, message: t('audit.testing') },
      }));
      try {
        const res = await fetch(`/api/admin/audit-log-sinks/${sink.id}/test`, { method: 'POST' });
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
                  message: t('audit.testOk', { status: data.result!.statusCode ?? '?' }),
                }
              : {
                  ok: false,
                  message:
                    data.result!.error ||
                    t('audit.testHttp', { status: data.result!.statusCode ?? '?' }),
                },
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [sink.id]: { ok: false, message: data.error || t('audit.testFailed') },
          }));
        }
      } catch (err) {
        setTestResults((prev) => ({
          ...prev,
          [sink.id]: {
            ok: false,
            message: err instanceof Error ? err.message : t('audit.testFailed'),
          },
        }));
      }
    },
    [t]
  );

  const typeOptions = useMemo(
    () =>
      SINK_TYPES.map((type) => ({
        value: type,
        label: t(`audit.type.${type}`),
      })),
    [t]
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {revealedSecret ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">{t('audit.signingSecret')}</p>
          <code className="bg-background mt-2 block break-all rounded px-3 py-2 font-mono text-xs">
            {revealedSecret.signingSecret}
          </code>
          <button
            type="button"
            className="text-muted-foreground mt-3 text-xs underline"
            onClick={() => setRevealedSecret(null)}
          >
            {t('audit.dismiss')}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {loading ? t('audit.loadingSinks') : t('audit.sinkCount', { count: sinks.length })}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-3 text-sm font-medium"
        >
          {showForm ? t('common.cancel') : t('audit.addSink')}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="surface-card space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t('audit.name')}</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('audit.namePlaceholder')}
                required
                className="bg-background rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t('audit.typeLabel')}</span>
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
                className="bg-background rounded-md border px-3 py-2 text-sm"
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
            <span className="font-medium">{t('audit.configJson')}</span>
            <textarea
              value={form.configJson}
              onChange={(e) => setForm((f) => ({ ...f, configJson: e.target.value }))}
              rows={8}
              className="bg-background rounded-md border px-3 py-2 font-mono text-xs"
            />
            <span className="text-muted-foreground text-xs">
              {form.type === 'webhook' ? t('audit.hint.webhook') : null}
              {form.type === 'splunk_hec' ? t('audit.hint.splunk_hec') : null}
              {form.type === 'datadog' ? t('audit.hint.datadog') : null}
              {form.type === 's3' ? t('audit.hint.s3') : null}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="hover:bg-muted/40 inline-flex h-9 items-center rounded-md border px-3 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-3 text-sm font-medium disabled:opacity-60"
            >
              {creating ? t('audit.creating') : t('audit.createSink')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {sinks.map((sink) => (
          <div key={sink.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">{sink.name}</p>
                  <span className="chip rounded-sm px-2 py-0.5 text-[11px]">
                    {t(`audit.type.${sink.type}`)}
                  </span>
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                      sink.enabled
                        ? 'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald border'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {sink.enabled ? t('audit.enabled') : t('audit.disabled')}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('audit.created', { date: new Date(sink.createdAt).toLocaleDateString() })}
                  {' · ✓ '}
                  {sink.successCount}
                  {' · ✗ '}
                  {sink.failureCount}
                  {sink.lastDeliveryAt
                    ? ` · ${t('audit.lastDelivery', {
                        date: new Date(sink.lastDeliveryAt).toLocaleString(),
                      })}`
                    : ''}
                </p>
                {sink.lastError ? (
                  <p className="text-destructive mt-1 text-xs">
                    {t('audit.lastError', { error: sink.lastError })}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(sink)}
                  className="hover:bg-muted/40 inline-flex h-8 items-center rounded-md border px-3 text-xs"
                >
                  {t('audit.test')}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(sink)}
                  className="hover:bg-muted/40 inline-flex h-8 items-center rounded-md border px-3 text-xs"
                >
                  {sink.enabled ? t('audit.disable') : t('audit.enable')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sink)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/5 inline-flex h-8 items-center rounded-md border px-3 text-xs"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            {(() => {
              const tr = testResults[sink.id];
              if (!tr) return null;
              return (
                <p
                  className={`mt-3 text-xs ${
                    tr.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {t('audit.testResult', { message: tr.message })}
                </p>
              );
            })()}
            <details className="text-muted-foreground mt-3 text-xs">
              <summary className="cursor-pointer select-none">{t('audit.config')}</summary>
              <pre className="bg-background mt-2 overflow-x-auto rounded p-3 text-[11px]">
                {JSON.stringify(sink.config, null, 2)}
              </pre>
            </details>
          </div>
        ))}
        {!loading && sinks.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            {t.rich('audit.emptyState', {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
