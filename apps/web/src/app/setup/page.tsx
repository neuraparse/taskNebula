'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const STEP_KEYS = ['stepAdmin', 'stepStart', 'stepDone'] as const;
const IMPORT_SOURCES = ['jira', 'linear', 'plane', 'csv', 'github'] as const;

type Stage = 'account' | 'start' | 'done';
type StartMode = 'blank' | 'import';
type ImportSource = (typeof IMPORT_SOURCES)[number];

type SetupResponse = {
  nextPath?: string;
};

function signInPath(callbackUrl: string) {
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

function toProjectKey(value: string) {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 10);
}

export default function SetupPage() {
  const router = useRouter();
  const t = useTranslations('publicPages');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [setupUnavailable, setSetupUnavailable] = useState(false);
  const [stage, setStage] = useState<Stage>('account');
  const [startMode, setStartMode] = useState<StartMode>('blank');
  const [importSource, setImportSource] = useState<ImportSource>('jira');
  const [redirectTo, setRedirectTo] = useState('/dashboard');
  const [keyManual, setKeyManual] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    importProjectName: '',
    importProjectKey: '',
  });

  useEffect(() => {
    fetch('/api/setup')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.databaseReady === false) {
          setSetupUnavailable(true);
          setError(t('setupDatabaseNotReady'));
          setLoading(false);
          return null;
        }
        return data as { setupRequired?: boolean };
      })
      .then((data) => {
        if (!data) return;
        if (!data.setupRequired) {
          router.replace('/auth/signin');
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        setSetupUnavailable(true);
        setError(t('setupConnectionError'));
        setLoading(false);
      });
  }, [router, t]);

  useEffect(() => {
    if (stage !== 'done') return;
    const timer = window.setTimeout(() => router.push(signInPath(redirectTo)), 1500);
    return () => window.clearTimeout(timer);
  }, [redirectTo, router, stage]);

  const currentStep = stage === 'done' ? 3 : stage === 'start' ? 2 : 1;
  const selectedSourceLabel = t(`setupImportSource.${importSource}.label`);

  const sourceSummary = useMemo(
    () => [
      t('setupSourceEvidence.jira'),
      t('setupSourceEvidence.linear'),
      t('setupSourceEvidence.plane'),
    ],
    [t]
  );

  const validateAccount = () => {
    if (form.password !== form.confirmPassword) {
      setError(t('setupPasswordsMismatch'));
      return false;
    }

    if (form.password.length < 8) {
      setError(t('setupPasswordTooShort'));
      return false;
    }

    setError('');
    return true;
  };

  const handleAccountSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateAccount()) return;
    setStage('start');
  };

  const handleProjectNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      importProjectName: value,
      importProjectKey: keyManual ? current.importProjectKey : toProjectKey(value),
    }));
  };

  const handleProjectKeyChange = (value: string) => {
    setKeyManual(true);
    setForm((current) => ({
      ...current,
      importProjectKey: value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10),
    }));
  };

  const handleCreateSetup = async () => {
    if (!validateAccount()) {
      setStage('account');
      return;
    }

    if (startMode === 'import') {
      if (!form.importProjectName.trim()) {
        setError(t('setupImportProjectRequired'));
        return;
      }
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(form.importProjectKey.trim())) {
        setError(t('setupImportProjectKeyInvalid'));
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          organizationName: form.organizationName.trim() || undefined,
          startMode,
          importSource: startMode === 'import' ? importSource : undefined,
          importProjectName: startMode === 'import' ? form.importProjectName.trim() : undefined,
          importProjectKey:
            startMode === 'import' ? form.importProjectKey.trim().toUpperCase() : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SetupResponse & { error?: string };

      if (!res.ok) {
        setError(t('setupFailed'));
        return;
      }

      setRedirectTo(data.nextPath || '/dashboard');
      setStage('done');
    } catch {
      setError(t('setupConnectionError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden">
        <div className="auth-carbon-spinner" aria-label={t('loading')} />
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="bg-background grid min-h-dvh place-items-center px-4">
        <div className="surface-card animate-fade-up border-t-primary w-full max-w-md space-y-5 border-t-2 p-8 text-center shadow-none">
          <div className="flex justify-center">
            <CheckCircle2 className="text-accent-emerald h-9 w-9" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t('setupComplete')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {startMode === 'import'
                ? t('setupImportRedirecting', { source: selectedSourceLabel })
                : t('setupRedirecting')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-background min-h-dvh">
      <div className="border-border bg-card border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <TaskNebulaLogo compact />
            <div>
              <p className="text-foreground text-sm font-semibold">{t('setupProductName')}</p>
              <p className="text-muted-foreground text-xs">{t('setupProductSubtitle')}</p>
            </div>
          </div>
          <span className="live-pill">
            <span className="status-dot status-live" aria-hidden="true" />
            {t('setupInstanceEmpty')}
          </span>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <div className="space-y-2">
            <span className="kicker">{t('setupKicker')}</span>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              {t('setupWelcomeTitle')}
            </h1>
            <p className="text-muted-foreground text-sm leading-6">{t('setupIntro')}</p>
          </div>

          <nav aria-label={t('setupProgress')} className="space-y-2">
            {STEP_KEYS.map((key, index) => {
              const stepNumber = index + 1;
              const isCurrent = stepNumber === currentStep;
              const isComplete = stepNumber < currentStep;
              return (
                <div
                  key={key}
                  className={cn(
                    'row-interactive flex items-center gap-3 rounded-md px-3 py-2.5',
                    isCurrent && 'border-primary/30 bg-primary/10 text-primary'
                  )}
                  data-active={isCurrent ? 'true' : undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-xs font-medium',
                      isComplete
                        ? 'border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald'
                        : isCurrent
                          ? 'border-primary/40 bg-background text-primary'
                          : 'border-border text-muted-foreground'
                    )}
                    aria-hidden="true"
                  >
                    {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNumber}
                  </span>
                  <span className="text-sm font-medium">{t(key)}</span>
                </div>
              );
            })}
          </nav>

          <div className="surface-inset space-y-2 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <LockKeyhole className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              <p className="text-foreground text-sm font-medium">{t('setupSecurityTitle')}</p>
            </div>
            <p className="text-muted-foreground text-xs leading-5">{t('setupSecurityBody')}</p>
          </div>
        </aside>

        <section className="min-w-0">
          {setupUnavailable ? (
            <div className="surface-card animate-fade-up border-t-destructive max-w-2xl space-y-4 border-t-2 p-6 shadow-none">
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
              <Button type="button" onClick={() => window.location.reload()}>
                {t('setupRetry')}
              </Button>
            </div>
          ) : stage === 'account' ? (
            <div className="surface-card animate-fade-up border-t-primary max-w-2xl space-y-6 border-t-2 p-6 shadow-none sm:p-8">
              <div className="space-y-2">
                <span className="kicker">{t('setupAdminKicker')}</span>
                <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                  {t('setupAdminTitle')}
                </h2>
                <p className="text-muted-foreground text-sm">{t('setupAdminSubtitle')}</p>
              </div>

              <form onSubmit={handleAccountSubmit} className="space-y-4">
                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t('setupFullName')}</Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      placeholder={t('setupFullNamePlaceholder')}
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t('setupEmailAddress')}</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder={t('setupEmailPlaceholder')}
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                      onChange={(event) =>
                        setForm((current) => ({ ...current, password: event.target.value }))
                      }
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
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                  </div>
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
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        organizationName: event.target.value,
                      }))
                    }
                  />
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  {t('setupContinue')}
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="surface-card animate-fade-up border-t-primary max-w-4xl space-y-6 border-t-2 p-6 shadow-none sm:p-8">
              <div className="space-y-2">
                <span className="kicker">{t('setupStartKicker')}</span>
                <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                  {t('setupStartTitle')}
                </h2>
                <p className="text-muted-foreground text-sm">{t('setupStartSubtitle')}</p>
              </div>

              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <StartModeButton
                  active={startMode === 'blank'}
                  icon={<Database className="h-5 w-5" />}
                  title={t('setupBlankTitle')}
                  description={t('setupBlankDescription')}
                  onClick={() => setStartMode('blank')}
                />
                <StartModeButton
                  active={startMode === 'import'}
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                  title={t('setupImportTitle')}
                  description={t('setupImportDescription')}
                  onClick={() => setStartMode('import')}
                />
              </div>

              {startMode === 'import' ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {IMPORT_SOURCES.map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setImportSource(source)}
                        className={cn(
                          'row-interactive min-h-[104px] rounded-lg border p-3 text-left transition-colors duration-150',
                          importSource === source
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border bg-card'
                        )}
                        data-active={importSource === source ? 'true' : undefined}
                        aria-pressed={importSource === source}
                      >
                        <div className="flex items-center gap-2">
                          <span className="icon-tile icon-tile-accent-blue h-7 w-7">
                            {source === 'github' ? (
                              <GitBranch className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Layers3 className="h-4 w-4" aria-hidden="true" />
                            )}
                          </span>
                          <span className="text-sm font-semibold">
                            {t(`setupImportSource.${source}.label`)}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs leading-5">
                          {t(`setupImportSource.${source}.description`)}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="surface-inset space-y-4 rounded-lg p-4">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                      <div className="space-y-1.5">
                        <Label htmlFor="importProjectName">{t('setupImportProjectName')}</Label>
                        <Input
                          id="importProjectName"
                          value={form.importProjectName}
                          onChange={(event) => handleProjectNameChange(event.target.value)}
                          placeholder={t('setupImportProjectNamePlaceholder')}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="importProjectKey">{t('setupImportProjectKey')}</Label>
                        <Input
                          id="importProjectKey"
                          value={form.importProjectKey}
                          onChange={(event) => handleProjectKeyChange(event.target.value)}
                          placeholder={t('setupImportProjectKeyPlaceholder')}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <KeyRound className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                          <p className="text-foreground text-sm font-medium">
                            {t('setupImportCredentialTitle', { source: selectedSourceLabel })}
                          </p>
                        </div>
                        <p className="text-muted-foreground text-xs leading-5">
                          {t(`setupImportSource.${importSource}.nextStep`)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {sourceSummary.map((item) => (
                          <p key={item} className="text-muted-foreground text-xs leading-5">
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="surface-inset rounded-lg p-4">
                  <p className="text-muted-foreground text-sm leading-6">{t('setupBlankNote')}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setStage('account')}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {t('setupBack')}
                </Button>
                <Button type="button" size="lg" onClick={handleCreateSetup} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t('setupCreatingAccount')}
                    </>
                  ) : (
                    <>
                      {startMode === 'import'
                        ? t('setupCreateAndImport', { source: selectedSourceLabel })
                        : t('setupCreateAdminAccount')}
                      <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <p className="text-muted-foreground mt-4 max-w-4xl text-xs">
            {t('setupDatabaseEmptyOnly')}
          </p>
        </section>
      </div>
    </main>
  );
}

function StartModeButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'row-interactive rounded-lg border p-4 text-left transition-colors duration-150',
        active ? 'border-primary/40 bg-primary/10' : 'border-border bg-card'
      )}
      data-active={active ? 'true' : undefined}
      aria-pressed={active}
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile icon-tile-accent-cyan h-9 w-9 shrink-0">{icon}</span>
        <span className="space-y-1">
          <span className="text-foreground block text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground block text-sm leading-5">{description}</span>
        </span>
      </div>
    </button>
  );
}
