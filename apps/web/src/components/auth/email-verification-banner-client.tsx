'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { MailCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DISMISS_STORAGE_KEY = 'tn-verify-banner-dismissed-until';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Client-side piece of the email verification banner. Owns the resend
 * request state and the localStorage-backed dismiss state. Kept separate
 * so the parent server component can do the "should we show this?" DB
 * check without shipping JS for it.
 */
export function EmailVerificationBannerClient({ email: _email }: { email: string }) {
  const t = useTranslations('authExtra');
  const router = useRouter();
  // Start hidden so SSR markup matches the first client paint (we only
  // know the dismissal state after reading localStorage on mount).
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      const until = raw ? Number.parseInt(raw, 10) : 0;
      if (!Number.isFinite(until) || Date.now() > until) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (SSR, private mode) — show by default.
      setVisible(true);
    }
  }, []);

  async function handleResend() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const message = data?.error || t('send_verification_failed');
        if (typeof toast.error === 'function') {
          toast.error(t('toast_send_failed_title'), message);
        } else {
          toast({ title: t('toast_send_failed_title'), description: message });
        }
        return;
      }
      if (typeof toast.success === 'function') {
        toast.success(t('toast_sent_title'), t('toast_sent_description'));
      } else {
        toast({
          title: t('toast_sent_title'),
          description: t('toast_sent_description'),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('network_error');
      if (typeof toast.error === 'function') {
        toast.error(t('toast_send_failed_title'), message);
      } else {
        toast({ title: t('toast_send_failed_title'), description: message });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleAlreadyVerified() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/auth/verify-email/refresh', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { verified?: boolean };
      if (data.verified) {
        if (typeof toast.success === 'function') {
          toast.success(t('toast_verified_title'), t('toast_verified_description'));
        } else {
          toast({ title: t('toast_verified_title'), description: t('toast_verified_description') });
        }
        setVisible(false);
        router.refresh();
        return;
      }
      const message = t('toast_not_verified_description');
      if (typeof toast.warning === 'function') {
        toast.warning(t('toast_not_verified_title'), message);
      } else {
        toast({ title: t('toast_not_verified_title'), description: message });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('network_error');
      if (typeof toast.error === 'function') {
        toast.error(t('toast_refresh_failed_title'), message);
      } else {
        toast({ title: t('toast_refresh_failed_title'), description: message });
      }
    } finally {
      setRefreshing(false);
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_TTL_MS));
    } catch {
      // Ignore storage failures — the banner will simply reappear next load.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        'border-b border-indigo-500/15 px-4 py-2 sm:px-6',
        'bg-gradient-to-r from-indigo-500/[0.06] via-violet-500/[0.05] to-transparent',
        'text-foreground text-sm'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
        >
          <MailCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-foreground truncate font-medium">{t('banner_title')}</p>
          <p className="text-muted-foreground truncate text-xs">{t('banner_description')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleAlreadyVerified}
          disabled={refreshing}
          aria-label={t('already_verified_aria')}
        >
          {refreshing ? t('checking_ellipsis') : t('already_verified')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleResend}
          disabled={sending}
          aria-label={t('resend_verification_email')}
        >
          {sending ? t('sending_ellipsis') : t('resend_email')}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={handleDismiss}
          aria-label={t('dismiss_aria')}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
