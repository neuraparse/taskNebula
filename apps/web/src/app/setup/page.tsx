'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

const STEPS = ['Admin account', 'Organization', 'Done'];

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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

      setSuccess(true);
      setTimeout(() => router.push('/auth/signin'), 2000);
    } catch {
      setError('Connection error. Please check your server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center">
        <div className="bg-aurora absolute inset-0 pointer-events-none animate-aurora opacity-80" />
        <div className="relative z-10 h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center px-4">
        <div className="bg-aurora absolute inset-0 pointer-events-none animate-aurora opacity-80" />
        <div className="relative z-10 w-full max-w-md animate-scale-in">
          <div className="surface-card p-8 shadow-lg rounded-xl text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-accent-emerald/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-accent-emerald" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Setup complete</h2>
              <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Aurora background */}
      <div className="bg-aurora absolute inset-0 pointer-events-none animate-aurora opacity-80" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        {/* Logo + heading */}
        <div className="mb-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
              <span className="text-sm font-bold tracking-tight text-background">TN</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to TaskNebula</h1>
            <p className="text-sm text-muted-foreground">Create your admin account to get started</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={i === 0 ? 'chip-accent' : 'chip'}
            >
              {step}
            </span>
          ))}
        </div>

        <div className="surface-card p-8 shadow-lg rounded-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
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
              {submitting ? 'Creating account...' : 'Create admin account'}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            This page is only available when the database is empty.
          </p>
        </div>
      </div>
    </div>
  );
}
