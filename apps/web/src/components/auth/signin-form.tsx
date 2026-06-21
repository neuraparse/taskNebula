'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, KeyRound, MailCheck, X } from 'lucide-react';
import Link from 'next/link';
import {
  EMPTY_OAUTH_PROVIDER_AVAILABILITY,
  OAuthProviderButtons,
  hasOAuthProviders,
  normalizeOAuthProviderAvailability,
  type OAuthProviderAvailability,
} from './oauth-provider-buttons';

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
  success: 'border-[#a7f0ba] bg-[#defbe6] text-[#0e6027]',
  warn: 'border-[#f1c21b] bg-[#fcf4d6] text-[#684e00]',
  danger: 'border-[#ffd7d9] bg-[#fff1f1] text-[#a2191f]',
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
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderAvailability>(
    EMPTY_OAUTH_PROVIDER_AVAILABILITY
  );

  const statusBanner = useMemo(() => resolveStatusBanner(searchParams), [searchParams]);
  const projectInviteToken = searchParams?.get('projectInviteToken') || null;
  const activeBanner =
    statusBanner && statusBanner.key !== dismissedBannerKey ? statusBanner : null;

  // Check if setup is needed — redirect before showing login
  useEffect(() => {
    let mounted = true;

    async function loadEntryState() {
      try {
        const [setupResponse, providersResponse] = await Promise.all([
          fetch('/api/setup'),
          fetch('/api/auth/oauth-providers', { cache: 'no-store' }),
        ]);

        const setupData = await setupResponse.json().catch(() => ({}));
        if (!mounted) return;

        if (setupData.setupRequired) {
          router.replace('/setup');
          return;
        }

        const providerData = providersResponse.ok
          ? await providersResponse.json().catch(() => ({}))
          : {};
        if (!mounted) return;

        setOauthProviders(normalizeOAuthProviderAvailability(providerData));
        setCheckingSetup(false);
      } catch {
        if (!mounted) return;
        setOauthProviders(EMPTY_OAUTH_PROVIDER_AVAILABILITY);
        setCheckingSetup(false);
      }
    }

    loadEntryState();

    return () => {
      mounted = false;
    };
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
        const redirectTo = await acceptProjectInviteAfterSignIn(projectInviteToken);
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError(tAuth('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const hasOAuth = hasOAuthProviders(oauthProviders);

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="auth-carbon-spinner" aria-label={tAuth('loading')} />
      </div>
    );
  }

  return (
    <div className="stagger space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="auth-carbon-heading">{tAuth('welcome_back')}</h1>
        <p className="auth-carbon-subtitle">{tAuth('subtitle')}</p>
      </div>

      {/* Status banner (verify / reset / error query params) */}
      {activeBanner && (
        <div
          key={activeBanner.key}
          role={activeBanner.tone === 'success' ? 'status' : 'alert'}
          className={`${BANNER_TONE_STYLES[activeBanner.tone]} auth-carbon-alert animate-alert-in flex items-start gap-3 border text-sm`}
        >
          <activeBanner.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-snug">{tAuth(activeBanner.messageKey)}</p>
          <button
            type="button"
            onClick={() => setDismissedBannerKey(activeBanner.key)}
            className="shrink-0 p-0.5 text-[#525252] transition-colors duration-150 hover:text-[#161616] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe]"
            aria-label={tAuth('dismiss_notification')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* OAuth Buttons */}
      {hasOAuth ? (
        <OAuthProviderButtons
          providers={oauthProviders}
          projectInviteToken={projectInviteToken}
          githubLabel={tAuth('continue_with_github')}
          googleLabel={tAuth('continue_with_google')}
        />
      ) : null}

      {/* Divider */}
      {hasOAuth ? (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2.5 text-[#525252]">
              {tAuth('or_continue_with_email')}
            </span>
          </div>
        </div>
      ) : null}

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="auth-carbon-label">
            {tAuth('email_label')}
          </Label>
          <Input
            id="email"
            type="email"
            className="auth-carbon-input"
            placeholder={tAuth('email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="auth-carbon-label">
              {tAuth('password_label')}
            </Label>
            <Link href="/auth/forgot-password" className="auth-carbon-link text-xs">
              {tAuth('forgot_password')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            className="auth-carbon-input"
            placeholder={tAuth('password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div
            className="auth-carbon-alert animate-alert-in border border-[#ffd7d9] bg-[#fff1f1] text-sm text-[#a2191f]"
            role="alert"
          >
            {error}
          </div>
        )}

        <Button type="submit" className="auth-carbon-primary w-full" size="lg" disabled={loading}>
          {loading ? tAuth('signin_loading') : tAuth('signin')}
        </Button>
      </form>

      {/* Sign Up Link */}
      <p className="text-sm text-[#525252]">
        {tAuth('no_account')}{' '}
        <Link
          href={
            projectInviteToken
              ? `/auth/signup?projectInviteToken=${encodeURIComponent(projectInviteToken)}`
              : '/auth/signup'
          }
          className="auth-carbon-link"
        >
          {tAuth('signup')}
        </Link>
      </p>
    </div>
  );
}

async function acceptProjectInviteAfterSignIn(projectInviteToken: string | null) {
  if (!projectInviteToken) return '/dashboard';

  const response = await fetch('/api/project-invite-links/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectInviteToken }),
  });

  if (!response.ok) return '/dashboard';

  const data = (await response.json().catch(() => ({}))) as { redirectTo?: string };
  return data.redirectTo || '/dashboard';
}
