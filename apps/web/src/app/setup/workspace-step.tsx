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

export function WorkspaceBootstrapStep({ onSkip, onDone }: Props) {
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
      setError('Please describe your project.');
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
        setError(data?.error || 'Failed to generate workspace preview.');
        return;
      }
      setSeed(data.seed);
    } catch {
      setError('Network error while contacting the bootstrapper.');
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
        setError(data?.error || 'Failed to apply workspace seed.');
        return;
      }
      onDone();
    } catch {
      setError('Network error while applying the workspace seed.');
    } finally {
      setApplying(false);
    }
  };

  if (!seed) {
    return (
      <div className="mx-auto max-w-2xl surface-card rounded-lg p-6 sm:p-8 animate-fade-up space-y-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="description">Tell us about your project</Label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. We are building a mobile app for tracking running routes with friends. We need to ship a private beta in 6 weeks."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="teamSize">Team size</Label>
            <select
              id="teamSize"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value as typeof teamSize)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {TEAM_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Your primary role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handlePreview} disabled={loading} size="lg" className="flex-1 sm:flex-none">
            {loading ? 'Generating…' : 'Preview workspace'}
          </Button>
          <Button onClick={onSkip} variant="ghost" size="lg">
            Skip / start blank
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Preview / edit step ----------
  return (
    <div className="mx-auto max-w-3xl surface-card rounded-lg p-6 sm:p-8 animate-fade-up space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Review your workspace</h2>
        <p className="text-sm text-muted-foreground">
          We will create the items below. Edit anything before applying.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="projectName">Project name</Label>
          <Input
            id="projectName"
            value={seed.projectName}
            onChange={(e) => setSeed({ ...seed, projectName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="projectKey">Project key</Label>
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
        <h3 className="text-sm font-medium text-foreground">Teams ({seed.teams.length})</h3>
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          {seed.teams.map((t, idx) => (
            <li key={idx}>
              <span className="text-foreground">{t.name}</span>{' '}
              <span className="text-xs">/ {t.slug}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Labels ({seed.labels.length})</h3>
        <div className="flex flex-wrap gap-1.5">
          {seed.labels.map((l, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"
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
        <h3 className="text-sm font-medium text-foreground">Cycles ({seed.cycles.length})</h3>
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          {seed.cycles.map((c, idx) => (
            <li key={idx}>
              <span className="text-foreground">{c.name}</span> — {c.startDate} → {c.endDate}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">
          Starter issues ({seed.issues.length})
        </h3>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">Hours</th>
              </tr>
            </thead>
            <tbody>
              {seed.issues.map((issue, idx) => (
                <tr key={idx} className="border-t border-border">
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
                  <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {issue.priority}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
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
          {applying ? 'Creating workspace…' : 'Create workspace'}
        </Button>
        <Button onClick={() => setSeed(null)} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={onSkip} variant="ghost" size="lg">
          Skip / start blank
        </Button>
      </div>
    </div>
  );
}
