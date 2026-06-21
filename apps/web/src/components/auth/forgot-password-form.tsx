'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const t = useTranslations('authExtra');
  const tAuth = useTranslations('auth');
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
        <div className="space-y-2">
          <h1 className="auth-carbon-heading">{t('check_inbox_title')}</h1>
          <p className="auth-carbon-subtitle">{t('check_inbox_description')}</p>
        </div>

        <Link href="/auth/signin" className="auth-carbon-link inline-block text-sm">
          {t('back_to_signin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="stagger space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="auth-carbon-heading">{t('forgot_password_title')}</h1>
        <p className="auth-carbon-subtitle">{t('forgot_password_subtitle')}</p>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="auth-carbon-label">
            {t('email_label')}
          </Label>
          <Input
            id="email"
            type="email"
            className="auth-carbon-input"
            placeholder={tAuth('email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <div
            className="auth-carbon-alert animate-alert-in border border-[#ffd7d9] bg-[#fff1f1] text-sm text-[#a2191f]"
            role="alert"
          >
            {error}
          </div>
        )}

        <Button type="submit" className="auth-carbon-primary w-full" size="lg" disabled={loading}>
          {loading ? t('sending') : t('send_reset_link')}
        </Button>
      </form>

      {/* Back to Sign In */}
      <p className="text-sm text-[#525252]">
        {t('remember_password')}{' '}
        <Link href="/auth/signin" className="auth-carbon-link">
          {t('signin')}
        </Link>
      </p>
    </div>
  );
}
