'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, Github, KeyRound, MailCheck, X } from 'lucide-react';
import Link from 'next/link';

type BannerTone = 'success' | 'warn' | 'danger';

// Banner messages were previously hard-coded in English here. They now live
// in `messages/{en,tr,de,es}.json` under `auth.banner_*`; this resolver
// returns the translation key so the component can call `t()` itself.
type StatusBanner = {
  key: string;
  tone: BannerTone;
  icon: ComponentType<{ className?: string }>;
  messageKey:
    | 'banner_email_verified'
    | 'banner_password_reset'
    | 'banner_incorrect_credentials'
    | 'banner_verification_invalid'
    | 'banner_generic_signin_error';
};

function resolveStatusBanner(params: URLSearchParams | null): StatusBanner | null {
  if (!params) return null;

  if (params.get('verified') === '1') {
    return {
      key: 'verified',
      tone: 'success',
      icon: MailCheck,
      messageKey: 'banner_email_verified',
    };
  }

  if (params.get('reset') === '1') {
    return {
      key: 'reset',
      tone: 'success',
      icon: KeyRound,
      messageKey: 'banner_password_reset',
    };
  }

  const errorParam = params.get('error');
  if (errorParam === 'CredentialsSignin') {
    return {
      key: 'error-credentials',
      tone: 'danger',
      icon: AlertCircle,
      messageKey: 'banner_incorrect_credentials',
    };
  }
  if (errorParam === 'Verification') {
    return {
      key: 'error-verification',
      tone: 'warn',
      icon: AlertTriangle,
      messageKey: 'banner_verification_invalid',
    };
  }
  if (errorParam) {
    return {
      key: `error-${errorParam}`,
      tone: 'danger',
      icon: AlertCircle,
      messageKey: 'banner_generic_signin_error',
    };
  }

  return null;
}

const BANNER_TONE_STYLES: Record<BannerTone, string> = {
  success: 'panel-success text-accent-emerald',
  warn: 'panel-warn text-accent-amber',
  danger: 'panel-danger text-destructive',
};

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);

  const statusBanner = useMemo(() => resolveStatusBanner(searchParams), [searchParams]);
  const activeBanner =
    statusBanner && statusBanner.key !== dismissedBannerKey ? statusBanner : null;

  // Check if setup is needed — redirect before showing login
  useEffect(() => {
    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.setupRequired) {
          router.replace('/setup');
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => setCheckingSetup(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(tAuth('invalid_credentials'));
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError(tAuth('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    await signIn('github', { callbackUrl: '/dashboard' });
  };

  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: '/dashboard' });
  };

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          aria-label={tAuth('loading')}
        />
      </div>
    );
  }

  return (
    <div className="stagger space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {tAuth('welcome_back')}
        </h1>
        <p className="text-muted-foreground text-sm">{tAuth('subtitle')}</p>
      </div>

      {/* Status banner (verify / reset / error query params) */}
      {activeBanner && (
        <div
          key={activeBanner.key}
          role={activeBanner.tone === 'success' ? 'status' : 'alert'}
          className={`${BANNER_TONE_STYLES[activeBanner.tone]} animate-alert-in flex items-start gap-3 px-3 py-2.5 text-sm`}
        >
          <activeBanner.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-foreground flex-1 leading-snug">{tAuth(activeBanner.messageKey)}</p>
          <button
            type="button"
            onClick={() => setDismissedBannerKey(activeBanner.key)}
            className="text-muted-foreground ease-snap hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm p-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
            aria-label={tAuth('dismiss_notification')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* OAuth Buttons */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={handleGitHubSignIn}
          type="button"
          className="ease-snap w-full transition-all duration-150"
          size="lg"
        >
          <Github className="me-2 h-4 w-4" />
          {tAuth('continue_with_github')}
        </Button>
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          type="button"
          className="ease-snap w-full transition-all duration-150"
          size="lg"
        >
          <svg className="me-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {tAuth('continue_with_google')}
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-2.5">
            {tAuth('or_continue_with_email')}
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{tAuth('email_label')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={tAuth('email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{tAuth('password_label')}</Label>
            <Link
              href="/auth/forgot-password"
              className="text-muted-foreground hover:text-foreground ease-snap text-xs transition-colors duration-150"
            >
              {tAuth('forgot_password')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder={tAuth('password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          {loading ? tAuth('signin_loading') : tAuth('signin')}
        </Button>
      </form>

      {/* Sign Up Link */}
      <p className="text-muted-foreground text-center text-sm">
        {tAuth('no_account')}{' '}
        <Link
          href="/auth/signup"
          className="text-foreground hover:text-primary ease-snap font-medium transition-colors duration-150"
        >
          {tAuth('signup')}
        </Link>
      </p>
    </div>
  );
}
