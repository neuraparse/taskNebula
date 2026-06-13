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
        <div className="space-y-1.5 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {t('password_reset_title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('password_reset_redirecting')}</p>
        </div>

        <div className="flex items-center justify-center py-2">
          <div
            className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            aria-label={t('redirecting')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="stagger space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('reset_password_title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('reset_password_subtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">{t('new_password_label')}</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-muted-foreground text-xs">{t('password_hint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t('confirm_password_label')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t('confirm_password_placeholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
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
          {loading ? t('resetting') : t('reset_password_submit')}
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
