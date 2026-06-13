'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const t = useTranslations('authExtra');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setError(t('generic_error'));
        return;
      }

      setSubmitted(true);
    } catch {
      setError(t('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="stagger space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {t('check_inbox_title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('check_inbox_description')}</p>
        </div>

        <div className="text-center">
          <Link
            href="/auth/signin"
            className="text-foreground hover:text-primary ease-snap text-sm font-medium transition-colors duration-150"
          >
            {t('back_to_signin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('forgot_password_title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('forgot_password_subtitle')}</p>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email_label')}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <div className="panel-danger animate-alert-in text-sm" role="alert">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="ease-snap w-full transition-all duration-150"
          size="lg"
          disabled={loading}
        >
          {loading ? t('sending') : t('send_reset_link')}
        </Button>
      </form>

      {/* Back to Sign In */}
      <p className="text-muted-foreground text-center text-sm">
        {t('remember_password')}{' '}
        <Link
          href="/auth/signin"
          className="text-foreground hover:text-primary ease-snap font-medium transition-colors duration-150"
        >
          {t('signin')}
        </Link>
      </p>
    </div>
  );
}
