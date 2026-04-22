'use client';

import { useState } from 'react';

/**
 * Small client button that POSTs to /api/auth/send-verification and
 * surfaces success/error messaging inline. Used on /auth/verify-request
 * when the visitor already has an authenticated session.
 */
export function VerifyRequestResendButton() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
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
