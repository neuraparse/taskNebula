'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('send_verification_failed'));
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('network_error'));
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="auth-carbon-primary inline-flex items-center justify-center px-4 text-sm disabled:pointer-events-none disabled:opacity-60"
      >
        {status === 'sending'
          ? t('sending_ellipsis')
          : status === 'sent'
            ? t('email_sent')
            : t('resend_verification_email')}
      </button>
      {status === 'error' && error ? <p className="text-xs text-[#a2191f]">{error}</p> : null}
      {status === 'sent' ? (
        <p className="text-xs text-[#525252]">{t('check_inbox_new_link')}</p>
      ) : null}
    </div>
  );
}
