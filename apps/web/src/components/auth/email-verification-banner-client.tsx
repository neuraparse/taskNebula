'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Client-side piece of the email verification banner. Owns the resend
 * request state. Kept separate so the parent server component can do
 * the "should we show this?" DB check without shipping JS for it.
 */
export function EmailVerificationBannerClient({ email }: { email: string }) {
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
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Please verify your email
          {email ? (
            <>
              {' '}
              (<span className="font-medium">{email}</span>)
            </>
          ) : null}
          . Some features may be restricted until you do.
        </span>
      </div>
      <div className="flex items-center gap-3">
        {status === 'error' && error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
        {status === 'sent' ? (
          <span className="text-xs font-medium">Email sent — check your inbox</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={status === 'sending'}
            className="inline-flex items-center rounded-md border border-amber-500/50 bg-transparent px-3 py-1 text-xs font-medium transition-colors hover:bg-amber-500/20 disabled:pointer-events-none disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Resend'}
          </button>
        )}
      </div>
    </div>
  );
}
