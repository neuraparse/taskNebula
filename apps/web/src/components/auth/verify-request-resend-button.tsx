'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface VerifyRequestResendButtonProps {
  /**
   * Optional email to include in the POST body. Passed when the visitor
   * is not yet authenticated (e.g. immediately after signup) so the
   * endpoint can resolve the user by email rather than session cookie.
   * When omitted, falls back to authenticated-session resolution.
   */
  email?: string;
}

/**
 * Small client button that POSTs to /api/auth/send-verification and
 * surfaces success/error messaging inline. Used on /auth/verify-request
 * both when the visitor has an authenticated session and when they
 * arrive with an `?email=` query param after signup.
 */
export function VerifyRequestResendButton({ email }: VerifyRequestResendButtonProps = {}) {
  const t = useTranslations('authExtra');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        ...(email
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            }
          : {}),
      });
      if (!res.ok) {
        setError(t('send_verification_failed'));
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setError(t('network_error'));
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="w-full text-sm"
        size="xl"
      >
        {status === 'sending'
          ? t('sending_ellipsis')
          : status === 'sent'
            ? t('email_sent')
            : t('resend_verification_email')}
      </Button>
      {status === 'error' && error ? (
        <p role="alert" className="text-destructive text-sm leading-5">
          {error}
        </p>
      ) : null}
      {status === 'sent' ? (
        <p role="status" className="text-muted-foreground text-xs leading-5">
          {t('check_inbox_new_link')}
        </p>
      ) : null}
    </div>
  );
}
