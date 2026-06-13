'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { WorkspaceBootstrapStep } from './workspace-step';

const STEP_KEYS = ['stepAdmin', 'stepWorkspace', 'stepDone'] as const;

type Stage = 'admin' | 'workspace' | 'done';

export default function SetupPage() {
  const router = useRouter();
  const t = useTranslations('publicPages');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [setupUnavailable, setSetupUnavailable] = useState(false);
  const [stage, setStage] = useState<Stage>('admin');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });

  useEffect(() => {
    // Check if setup is needed
    fetch('/api/setup')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.databaseReady === false) {
          setSetupUnavailable(true);
          setError(data.error || t('setupDatabaseNotReady'));
          setLoading(false);
          return;
        }
        return data;
      })
      .then((data) => {
        if (!data) return;
        if (!data.setupRequired) {
          router.replace('/auth/signin');
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setSetupUnavailable(true);
        setError(t('setupConnectionError'));
        setLoading(false);
      });
  }, [router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError(t('setupPasswordsMismatch'));
      return;
    }

    if (form.password.length < 8) {
      setError(t('setupPasswordTooShort'));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          organizationName: form.organizationName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('setupFailed'));
        return;
      }

      // Admin created — now offer the AI bootstrapper step.
      setStage('workspace');
    } catch {
      setError(t('setupConnectionError'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep = stage === 'done' ? STEP_KEYS.length : stage === 'workspace' ? 2 : 1;

  if (loading) {
    return (
      <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
        />
        <div
          className="border-foreground relative h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          aria-label={t('loading')}
        />
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden px-4">
        <div
          aria-hidden="true"
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
        />
        <div className="animate-fade-up relative w-full max-w-sm">
          <div className="surface-card space-y-4 rounded-lg p-8 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="text-accent-emerald h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                {t('setupComplete')}
              </h2>
              <p className="text-muted-foreground text-sm">{t('setupRedirecting')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Aurora glow */}
      <div
        aria-hidden="true"
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
      />

      <div className="animate-fade-up relative w-full max-w-3xl">
        {/* Brand + heading */}
        <div className="mb-6 space-y-3 text-center">
          <div className="flex justify-center">
            <div className="bg-foreground flex h-9 w-9 items-center justify-center rounded-md">
              <span className="text-background text-xs font-semibold tracking-tight">TN</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t('setupWelcomeTitle')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {stage === 'admin' ? t('setupAdminSubtitle') : t('setupWorkspaceSubtitle')}
            </p>
          </div>
        </div>

        {/* Step nav chips */}
        <nav
          aria-label={t('setupProgress')}
          className="mb-6 flex items-center justify-center gap-2"
        >
          {STEP_KEYS.map((key, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === currentStep;
            const isComplete = stepNum < currentStep;
            const chipClass = isComplete ? 'chip-emerald' : isCurrent ? 'chip-accent' : 'chip';
            return (
              <span key={key} className={chipClass} aria-current={isCurrent ? 'step' : undefined}>
                <span className="tabular-nums">{stepNum}</span>
                <span>{t(key)}</span>
              </span>
            );
          })}
        </nav>

        {setupUnavailable ? (
          <div className="surface-card mx-auto max-w-md rounded-lg p-6 text-center sm:p-8">
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
            <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
              {t('setupRetry')}
            </Button>
          </div>
        ) : stage === 'admin' ? (
          <div className="surface-card animate-fade-up mx-auto max-w-md rounded-lg p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">{t('setupFullName')}</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  placeholder={t('setupFullNamePlaceholder')}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">{t('setupEmailAddress')}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="admin@company.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t('setupPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder={t('setupPasswordPlaceholder')}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t('setupConfirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder={t('setupConfirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgName">
                  {t.rich('setupOrganizationName', {
                    optional: (chunks) => (
                      <span className="text-muted-foreground font-normal">{chunks}</span>
                    ),
                  })}
                </Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder={t('setupOrganizationNamePlaceholder')}
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? t('setupCreatingAccount') : t('setupCreateAdminAccount')}
              </Button>
            </form>
          </div>
        ) : (
          <WorkspaceBootstrapStep
            onSkip={() => {
              setStage('done');
              setTimeout(() => router.push('/auth/signin'), 1500);
            }}
            onDone={() => {
              setStage('done');
              setTimeout(() => router.push('/auth/signin'), 1500);
            }}
          />
        )}

        <p className="text-muted-foreground mt-4 text-center text-xs">
          {t('setupDatabaseEmptyOnly')}
        </p>
      </div>
    </div>
  );
}
