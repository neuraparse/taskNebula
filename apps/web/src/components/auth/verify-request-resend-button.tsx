'use client';

import { useState } from 'react';

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
export function VerifyRequestResendButton({
  email,
}: VerifyRequestResendButtonProps = {}) {
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
        setError(data?.error || 'Failed to send verification email');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {status === 'sending'
          ? 'Sending…'
          : status === 'sent'
            ? 'Email sent'
            : 'Resend verification email'}
      </button>
      {status === 'error' && error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      {status === 'sent' ? (
        <p className="text-xs text-muted-foreground">
          Check your inbox for the new link.
        </p>
      ) : null}
    </div>
  );
}
