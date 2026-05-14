'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { WorkspaceBootstrapStep } from './workspace-step';

const STEP_LABELS = ['Admin', 'Workspace', 'Done'] as const;

type Stage = 'admin' | 'workspace' | 'done';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
      .then((res) => res.json())
      .then((data) => {
        if (!data.setupRequired) {
          router.replace('/auth/signin');
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
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
        setError(data.error || 'Setup failed');
        return;
      }

      // Admin created — now offer the AI bootstrapper step.
      setStage('workspace');
    } catch {
      setError('Connection error. Please check your server.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep =
    stage === 'done' ? STEP_LABELS.length : stage === 'workspace' ? 2 : 1;

  if (loading) {
    return (
      <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden">
        <div
          aria-hidden="true"
          className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
        />
        <div
          className="relative h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden px-4">
        <div
          aria-hidden="true"
          className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
        />
        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="surface-card rounded-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-8 w-8 text-accent-emerald" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Setup complete</h2>
              <p className="text-sm text-muted-foreground">Redirecting to sign in&hellip;</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden px-4 py-10">
      {/* Aurora glow */}
      <div
        aria-hidden="true"
        className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
      />

      <div className="relative w-full max-w-3xl animate-fade-up">
        {/* Brand + heading */}
        <div className="mb-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground">
              <span className="text-xs font-semibold tracking-tight text-background">TN</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome to TaskNebula
            </h1>
            <p className="text-sm text-muted-foreground">
              {stage === 'admin'
                ? 'Create your admin account to get started'
                : 'Tell us about your project — we will draft a workspace for you'}
            </p>
          </div>
        </div>

        {/* Step nav chips */}
        <nav
          aria-label="Setup progress"
          className="mb-6 flex items-center justify-center gap-2"
        >
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === currentStep;
            const isComplete = stepNum < currentStep;
            const chipClass = isComplete
              ? 'chip-emerald'
              : isCurrent
                ? 'chip-accent'
                : 'chip';
            return (
              <span
                key={label}
                className={chipClass}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="tabular-nums">{stepNum}</span>
                <span>{label}</span>
              </span>
            );
          })}
        </nav>

        {stage === 'admin' ? (
          <div className="mx-auto max-w-md surface-card rounded-lg p-6 sm:p-8 animate-fade-up">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  placeholder="John Doe"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgName">
                  Organization name{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="My Company"
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create admin account'}
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

        <p className="mt-4 text-xs text-muted-foreground text-center">
          This page is only available when the database is empty.
        </p>
      </div>
    </div>
  );
}
