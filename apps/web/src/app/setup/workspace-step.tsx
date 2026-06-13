'use client';

/**
 * AI Workspace Bootstrapper UI step (P1-13).
 *
 * Renders a description textarea + team-size + role select, calls
 * /api/onboarding/seed-preview to get a draft seed, lets the admin edit
 * a few high-level fields and either applies the seed via
 * /api/onboarding/seed-apply or skips with a blank workspace.
 *
 * NOTE: this step runs *immediately after admin creation* on the same
 * /setup page, so the user is not yet signed in. The two onboarding
 * endpoints require auth, so if the call fails with 401 we fall back to
 * "go sign in and finish onboarding from the dashboard" — but in
 * practice deployers can hit the wizard from a signed-in session as well.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TEAM_SIZES = ['solo', '2-5', '6-15', '16-50', '50+'] as const;
const ROLES = [
  'engineering',
  'product',
  'design',
  'marketing',
  'operations',
  'founder',
  'other',
] as const;

type WorkspaceSeed = {
  projectName: string;
  projectKey: string;
  teams: Array<{ name: string; slug: string; members?: string[] }>;
  labels: Array<{ name: string; color: string }>;
  priorities: string[];
  cycles: Array<{ name: string; startDate: string; endDate: string }>;
  issues: Array<{
    title: string;
    description?: string | null;
    labels: string[];
    priority: string;
    estimateHours?: number | null;
    assigneeRole?: string;
  }>;
};

interface Props {
  onSkip: () => void;
  onDone: () => void;
}

const ROLE_KEYS: Record<(typeof ROLES)[number], string> = {
  engineering: 'roleEngineering',
  product: 'roleProduct',
  design: 'roleDesign',
  marketing: 'roleMarketing',
  operations: 'roleOperations',
  founder: 'roleFounder',
  other: 'roleOther',
};

export function WorkspaceBootstrapStep({ onSkip, onDone }: Props) {
  const t = useTranslations('publicPages');
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState<(typeof TEAM_SIZES)[number]>('2-5');
  const [role, setRole] = useState<(typeof ROLES)[number]>('engineering');
  const [seed, setSeed] = useState<WorkspaceSeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async () => {
    setError('');
    if (!description.trim()) {
      setError(t('workspaceDescribeRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/seed-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDescription: description.trim(),
          teamSize,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t('workspacePreviewFailed'));
        return;
      }
      setSeed(data.seed);
    } catch {
      setError(t('workspacePreviewNetworkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!seed) return;
    setApplying(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/seed-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 401 = user is not yet signed in (expected immediately after
        // admin creation). In that case, treat as skip + nudge to sign in.
        if (res.status === 401) {
          onDone();
          return;
        }
        setError(data?.error || t('workspaceApplyFailed'));
        return;
      }
      onDone();
    } catch {
      setError(t('workspaceApplyNetworkError'));
    } finally {
      setApplying(false);
    }
  };

  if (!seed) {
    return (
      <div className="surface-card animate-fade-up mx-auto max-w-2xl space-y-4 rounded-lg p-6 sm:p-8">
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="description">{t('workspaceTellUsTitle')}</Label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
            placeholder={t('workspaceDescriptionPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="teamSize">{t('workspaceTeamSize')}</Label>
            <select
              id="teamSize"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value as typeof teamSize)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {TEAM_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s === 'solo' ? t('teamSizeSolo') : s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">{t('workspacePrimaryRole')}</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_KEYS[r])}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={handlePreview}
            disabled={loading}
            size="lg"
            className="flex-1 sm:flex-none"
          >
            {loading ? t('workspaceGenerating') : t('workspacePreview')}
          </Button>
          <Button onClick={onSkip} variant="ghost" size="lg">
            {t('workspaceSkip')}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Preview / edit step ----------
  return (
    <div className="surface-card animate-fade-up mx-auto max-w-3xl space-y-6 rounded-lg p-6 sm:p-8">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <header className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">{t('workspaceReviewTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('workspaceReviewSubtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="projectName">{t('workspaceProjectName')}</Label>
          <Input
            id="projectName"
            value={seed.projectName}
            onChange={(e) => setSeed({ ...seed, projectName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="projectKey">{t('workspaceProjectKey')}</Label>
          <Input
            id="projectKey"
            value={seed.projectKey}
            onChange={(e) =>
              setSeed({ ...seed, projectKey: e.target.value.toUpperCase().slice(0, 8) })
            }
          />
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-medium">
          {t('workspaceTeamsCount', { count: seed.teams.length })}
        </h3>
        <ul className="text-muted-foreground list-disc pl-5 text-sm">
          {seed.teams.map((team, idx) => (
            <li key={idx}>
              <span className="text-foreground">{team.name}</span>{' '}
              <span className="text-xs">/ {team.slug}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-medium">
          {t('workspaceLabelsCount', { count: seed.labels.length })}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {seed.labels.map((l, idx) => (
            <span
              key={idx}
              className="border-border inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-medium">
          {t('workspaceCyclesCount', { count: seed.cycles.length })}
        </h3>
        <ul className="text-muted-foreground list-disc pl-5 text-sm">
          {seed.cycles.map((c, idx) => (
            <li key={idx}>
              <span className="text-foreground">{c.name}</span> — {c.startDate} → {c.endDate}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-medium">
          {t('workspaceStarterIssuesCount', { count: seed.issues.length })}
        </h3>
        <div className="border-border overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left">{t('workspaceColTitle')}</th>
                <th className="px-3 py-2 text-left">{t('workspaceColPriority')}</th>
                <th className="px-3 py-2 text-left">{t('workspaceColHours')}</th>
              </tr>
            </thead>
            <tbody>
              {seed.issues.map((issue, idx) => (
                <tr key={idx} className="border-border border-t">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={issue.title}
                      onChange={(e) => {
                        const issues = [...seed.issues];
                        issues[idx] = { ...issues[idx]!, title: e.target.value };
                        setSeed({ ...seed, issues });
                      }}
                      className="w-full bg-transparent focus:outline-none"
                    />
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs uppercase tracking-wide">
                    {issue.priority}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {issue.estimateHours ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleApply} disabled={applying} size="lg" className="flex-1 sm:flex-none">
          {applying ? t('workspaceCreating') : t('workspaceCreate')}
        </Button>
        <Button onClick={() => setSeed(null)} variant="outline" size="lg">
          {t('workspaceBack')}
        </Button>
        <Button onClick={onSkip} variant="ghost" size="lg">
          {t('workspaceSkip')}
        </Button>
      </div>
    </div>
  );
}
