'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Source picker → adapter form → preview / mapping → run import flow.
 *
 * Polls `/api/import/jobs/[id]` every 2s while a job is running so the
 * progress bar advances. Errors collected by the runner are surfaced
 * inline so the user can decide whether to re-run or fix the source.
 *
 * Polling cadence is intentionally simple (no exponential backoff) —
 * imports are short-lived enough that a fixed interval is fine. When
 * a real queue + websocket push lands, swap polling for the realtime
 * channel TaskNebula already runs.
 */

type SourceKey = 'csv' | 'linear' | 'jira' | 'github';

type PreviewRecord = {
  key: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  labels: string[];
  assigneeEmail: string | null;
};

type JobStatusResponse = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  errors: Array<{ key?: string; message: string }>;
};

const SOURCES: Array<{ key: SourceKey; ready: boolean }> = [
  { key: 'csv', ready: true },
  { key: 'linear', ready: false },
  { key: 'jira', ready: false },
  { key: 'github', ready: false },
];

const MAPPABLE_FIELDS: string[] = [
  'title',
  'description',
  'status',
  'priority',
  'labels',
  'assigneeEmail',
  'parentKey',
  'createdAt',
  'key',
];

export function ImportWizard({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settingsClients');
  const [source, setSource] = useState<SourceKey | null>(null);
  const [projectId, setProjectId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  // Linear / Jira / GitHub creds
  const [linearKey, setLinearKey] = useState('');
  const [linearTeam, setLinearTeam] = useState('');
  const [jiraSite, setJiraSite] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('');
  const [ghRepo, setGhRepo] = useState('');

  const [preview, setPreview] = useState<PreviewRecord[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    // Very loose header preview — the server returns the authoritative
    // suggested mapping when we hit /preview.
    setCsvHeaders(firstLine.split(',').map((h) => h.trim()));
  }

  function buildPreviewBody(): Record<string, unknown> {
    const base: Record<string, unknown> = { workspaceId };
    switch (source) {
      case 'csv':
        return { ...base, csvText, columns };
      case 'linear':
        return { ...base, apiKey: linearKey, teamKey: linearTeam || undefined };
      case 'jira':
        return { ...base, site: jiraSite, email: jiraEmail, apiToken: jiraToken };
      case 'github':
        return { ...base, accessToken: ghToken, owner: ghOwner, repo: ghRepo };
      default:
        return base;
    }
  }

  async function runPreview() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${source}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPreviewBody()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t('import.previewFailed', { status: res.status }));
      }
      const data = await res.json();
      setPreview(data.sample ?? []);
      setPreviewTotal(data.total ?? 0);
      if (source === 'csv' && data.suggestedMapping) {
        // Merge: only fill in fields the user hasn't already chosen.
        setColumns((current) => ({ ...data.suggestedMapping, ...current }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!source || !projectId) {
      setError(t('import.projectIdRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        workspaceId,
        projectId,
        mapping: {
          columns,
          config: buildPreviewBody(),
        },
        csvText: source === 'csv' ? csvText : undefined,
      };
      const res = await fetch(`/api/import/${source}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? t('import.importFailedStatus', { status: res.status }));
      }
      const { jobId } = await res.json();
      pollJob(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function pollJob(jobId: string) {
    const tick = async () => {
      try {
        const res = await fetch(`/api/import/jobs/${jobId}`);
        if (!res.ok) throw new Error(t('import.jobStatusFailed'));
        const data: JobStatusResponse = await res.json();
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setBusy(false);
          return;
        }
        setTimeout(tick, 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    };
    void tick();
  }

  if (!source) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <button
            type="button"
            key={s.key}
            onClick={() => setSource(s.key)}
            className="border-border bg-card hover:border-foreground/30 rounded-lg border p-4 text-left transition hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t(`import.source.${s.key}.label`)}</span>
              {!s.ready && (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {t('import.previewBadge')}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(`import.source.${s.key}.description`)}
            </p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setSource(null)}>
          {t('import.back')}
        </Button>
        <span className="text-sm font-medium">
          {t('import.importingFrom', { source: t(`import.source.${source}.label`) })}
        </span>
      </div>

      {/* Source-specific form */}
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <Label htmlFor="projectId">{t('import.targetProjectId')}</Label>
        <Input
          id="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="prj_xxx"
        />

        {source === 'csv' && (
          <div className="space-y-2">
            <Label htmlFor="csvFile">{t('import.csvFile')}</Label>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="block w-full text-sm"
            />
          </div>
        )}

        {source === 'linear' && (
          <div className="space-y-2">
            <Label htmlFor="linearKey">{t('import.linearKey')}</Label>
            <Input
              id="linearKey"
              type="password"
              value={linearKey}
              onChange={(e) => setLinearKey(e.target.value)}
            />
            <Label htmlFor="linearTeam">{t('import.linearTeam')}</Label>
            <Input
              id="linearTeam"
              value={linearTeam}
              onChange={(e) => setLinearTeam(e.target.value)}
              placeholder="ENG"
            />
          </div>
        )}

        {source === 'jira' && (
          <div className="space-y-2">
            <Label htmlFor="jiraSite">{t('import.jiraSite')}</Label>
            <Input
              id="jiraSite"
              value={jiraSite}
              onChange={(e) => setJiraSite(e.target.value)}
              placeholder="acme.atlassian.net"
            />
            <Label htmlFor="jiraEmail">{t('import.jiraEmail')}</Label>
            <Input
              id="jiraEmail"
              type="email"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
            />
            <Label htmlFor="jiraToken">{t('import.jiraToken')}</Label>
            <Input
              id="jiraToken"
              type="password"
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
            />
          </div>
        )}

        {source === 'github' && (
          <div className="space-y-2">
            <Label htmlFor="ghToken">{t('import.ghToken')}</Label>
            <Input
              id="ghToken"
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
            />
            <Label htmlFor="ghOwner">{t('import.ghOwner')}</Label>
            <Input id="ghOwner" value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} />
            <Label htmlFor="ghRepo">{t('import.ghRepo')}</Label>
            <Input id="ghRepo" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} />
          </div>
        )}

        <Button onClick={runPreview} disabled={busy} className="mt-2">
          {busy ? t('import.loading') : t('import.preview')}
        </Button>
      </div>

      {/* Column mapping (CSV only) */}
      {source === 'csv' && csvHeaders.length > 0 && (
        <div className="border-border bg-card space-y-2 rounded-lg border p-4">
          <div className="text-sm font-medium">{t('import.columnMapping')}</div>
          <p className="text-muted-foreground text-xs">{t('import.columnMappingHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MAPPABLE_FIELDS.map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`map-${field}`} className="text-xs">
                  {t(`import.field.${field}`)}
                </Label>
                <select
                  id={`map-${field}`}
                  value={columns[field] ?? ''}
                  onChange={(e) => setColumns((c) => ({ ...c, [field]: e.target.value }))}
                  className="border-border bg-background w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value="">{t('import.none')}</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="border-border bg-card space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {t('import.previewCount', { shown: preview.length, total: previewTotal })}
            </div>
            <Button onClick={runImport} disabled={busy || !projectId}>
              {t('import.runImport')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-1 pr-2">{t('import.col.key')}</th>
                  <th className="py-1 pr-2">{t('import.col.title')}</th>
                  <th className="py-1 pr-2">{t('import.col.status')}</th>
                  <th className="py-1 pr-2">{t('import.col.priority')}</th>
                  <th className="py-1 pr-2">{t('import.col.assignee')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.key} className="border-border/60 border-t">
                    <td className="py-1 pr-2 font-mono text-[11px]">{r.key}</td>
                    <td className="py-1 pr-2">{r.title}</td>
                    <td className="py-1 pr-2">{r.status ?? '—'}</td>
                    <td className="py-1 pr-2">{r.priority ?? '—'}</td>
                    <td className="py-1 pr-2">{r.assigneeEmail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress */}
      {jobStatus && (
        <div className="border-border bg-card space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {jobStatus.status === 'completed'
                ? t('import.complete')
                : jobStatus.status === 'failed'
                  ? t('import.failed')
                  : t('import.importing')}
            </span>
            <span className="text-muted-foreground">
              {jobStatus.processed} / {jobStatus.total}
            </span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded">
            <div
              className="bg-foreground h-full transition-all"
              style={{
                width:
                  jobStatus.total > 0
                    ? `${Math.min(100, Math.round((jobStatus.processed / jobStatus.total) * 100))}%`
                    : '0%',
              }}
            />
          </div>
          {jobStatus.errors.length > 0 && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive rounded border p-2 text-xs">
              <div className="mb-1 font-medium">
                {t('import.recordsFailed', { count: jobStatus.errors.length })}
              </div>
              <ul className="space-y-0.5">
                {jobStatus.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">{e.key ?? '?'}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded border p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
