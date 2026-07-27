'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  AUTH_INPUT_CLASS_NAME,
  AUTH_STANDALONE_LINK_CLASS_NAME,
  AuthFieldError,
  AuthFormAlert,
  AuthIntro,
  AuthLoading,
} from './auth-ui';

interface ResetPasswordFormProps {
  token: string;
}

type PasswordField = 'newPassword' | 'confirmPassword';

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('authExtra');
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<{
    field: PasswordField;
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState('');
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
    setFieldError(null);
    setFormError('');

    if (newPassword.length < 8) {
      setFieldError({ field: 'newPassword', message: t('password_min_length') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldError({ field: 'confirmPassword', message: t('passwords_no_match') });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!response.ok) {
        setFormError(t('reset_failed'));
        return;
      }

      setSuccess(true);
    } catch {
      setFormError(t('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="animate-fade-up space-y-5">
        <AuthIntro
          title={t('password_reset_title')}
          description={t('password_reset_redirecting')}
        />
        <AuthLoading label={t('redirecting')} />
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-7">
      <AuthIntro title={t('reset_password_title')} description={t('reset_password_subtitle')} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="newPassword">{t('new_password_label')}</Label>
          <Input
            id="newPassword"
            type="password"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (fieldError?.field === 'newPassword') setFieldError(null);
              if (formError) setFormError('');
            }}
            required
            autoComplete="new-password"
            minLength={8}
            aria-invalid={fieldError?.field === 'newPassword'}
            aria-describedby={
              fieldError?.field === 'newPassword'
                ? 'new-password-hint new-password-error'
                : 'new-password-hint'
            }
          />
          <p id="new-password-hint" className="text-muted-foreground text-xs leading-5">
            {t('password_hint')}
          </p>
          {fieldError?.field === 'newPassword' ? (
            <AuthFieldError id="new-password-error">{fieldError.message}</AuthFieldError>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('confirm_password_label')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={t('confirm_password_placeholder')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldError?.field === 'confirmPassword') setFieldError(null);
              if (formError) setFormError('');
            }}
            required
            autoComplete="new-password"
            minLength={8}
            aria-invalid={fieldError?.field === 'confirmPassword'}
            aria-describedby={
              fieldError?.field === 'confirmPassword' ? 'confirm-password-error' : undefined
            }
          />
          {fieldError?.field === 'confirmPassword' ? (
            <AuthFieldError id="confirm-password-error">{fieldError.message}</AuthFieldError>
          ) : null}
        </div>

        {formError ? <AuthFormAlert id="reset-form-error">{formError}</AuthFormAlert> : null}

        <Button type="submit" className="w-full text-sm" size="xl" disabled={loading}>
          {loading ? t('resetting') : t('reset_password_submit')}
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
