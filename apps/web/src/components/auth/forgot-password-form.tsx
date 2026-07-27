'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  AUTH_INPUT_CLASS_NAME,
  AUTH_STANDALONE_LINK_CLASS_NAME,
  AuthFieldError,
  AuthIntro,
} from './auth-ui';

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
      <div className="animate-fade-up space-y-7">
        <AuthIntro title={t('check_inbox_title')} description={t('check_inbox_description')} />

        <Link href="/auth/signin" className={`${AUTH_STANDALONE_LINK_CLASS_NAME} text-sm`}>
          {t('back_to_signin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-7">
      <AuthIntro title={t('forgot_password_title')} description={t('forgot_password_subtitle')} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t('email_label')}</Label>
          <Input
            id="email"
            type="email"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={tAuth('email_placeholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            required
            autoComplete="email"
            aria-invalid={!!error}
            aria-describedby={error ? 'forgot-email-error' : undefined}
          />
          {error ? <AuthFieldError id="forgot-email-error">{error}</AuthFieldError> : null}
        </div>

        <Button type="submit" className="w-full text-sm" size="xl" disabled={loading}>
          {loading ? t('sending') : t('send_reset_link')}
        </Button>
      </form>

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
        <span>{t('remember_password')}</span>
        <Link href="/auth/signin" className={AUTH_STANDALONE_LINK_CLASS_NAME}>
          {t('signin')}
        </Link>
      </p>
    </div>
  );
}
