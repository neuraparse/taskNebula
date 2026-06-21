'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('authExtra');
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push('/auth/signin?reset=1');
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('password_min_length'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwords_no_match'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || t('reset_failed'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="stagger space-y-6">
        <div className="space-y-2">
          <h1 className="auth-carbon-heading">{t('password_reset_title')}</h1>
          <p className="auth-carbon-subtitle">{t('password_reset_redirecting')}</p>
        </div>

        <div className="flex items-center py-2">
          <div className="auth-carbon-spinner" aria-label={t('redirecting')} />
        </div>
      </div>
    );
  }

  return (
    <div className="stagger space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="auth-carbon-heading">{t('reset_password_title')}</h1>
        <p className="auth-carbon-subtitle">{t('reset_password_subtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="auth-carbon-label">
            {t('new_password_label')}
          </Label>
          <Input
            id="newPassword"
            type="password"
            className="auth-carbon-input"
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-xs text-[#525252]">{t('password_hint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="auth-carbon-label">
            {t('confirm_password_label')}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            className="auth-carbon-input"
            placeholder={t('confirm_password_placeholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
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
          {loading ? t('resetting') : t('reset_password_submit')}
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
