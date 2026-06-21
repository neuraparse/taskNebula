'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import {
  EMPTY_OAUTH_PROVIDER_AVAILABILITY,
  OAuthProviderButtons,
  hasOAuthProviders,
  normalizeOAuthProviderAvailability,
  type OAuthProviderAvailability,
} from './oauth-provider-buttons';

type SignupResponse = {
  error?: string;
  code?: string;
  projectInvite?: {
    projectKey: string;
  };
};

type SignupErrorKey =
  | 'registration_invite_required'
  | 'registration_admin_only'
  | 'project_invite_invalid'
  | 'signup_failed';

export function SignUpForm() {
  const t = useTranslations('authExtra');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [projectInviteToken, setProjectInviteToken] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderAvailability>(
    EMPTY_OAUTH_PROVIDER_AVAILABILITY
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const invitedEmail = new URLSearchParams(window.location.search).get('email');
    const projectToken = new URLSearchParams(window.location.search).get('projectInviteToken');
    if (invitedEmail) setEmail(invitedEmail.trim().toLowerCase());
    if (projectToken) setProjectInviteToken(projectToken);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('password_min_length'));
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const inviteToken =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('token')
          : null;
      const activeProjectInviteToken =
        projectInviteToken ||
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('projectInviteToken')
          : null);
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: normalizedEmail,
          password,
          ...(inviteToken ? { inviteToken } : {}),
          ...(activeProjectInviteToken ? { projectInviteToken: activeProjectInviteToken } : {}),
        }),
      });

      const data = (await response.json()) as SignupResponse;

      if (!response.ok) {
        setError(getSignupErrorMessage(data, t));
        return;
      }

      // Auto sign in after successful signup so the verify-request page
      // can expose the resend button and show the user context. If that
      // fails for any reason we still fall through to verify-request —
      // the ?email= query param keeps the resend flow working.
      try {
        await signIn('credentials', {
          email: normalizedEmail,
          password,
          redirect: false,
        });
      } catch {
        // Ignore — we degrade to the email-query-param path below.
      }

      const projectKey = data.projectInvite?.projectKey;
      router.push(
        projectKey
          ? `/projects/${encodeURIComponent(projectKey)}`
          : `/auth/verify-request?email=${encodeURIComponent(normalizedEmail)}`
      );
      router.refresh();
    } catch {
      setError(t('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const hasOAuth = hasOAuthProviders(oauthProviders);

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="auth-carbon-spinner" aria-label={t('loading')} />
      </div>
    );
  }

  return (
    <div className="stagger space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="auth-carbon-heading">{t('create_account_title')}</h1>
        <p className="auth-carbon-subtitle">{t('create_account_subtitle')}</p>
      </div>

      {/* OAuth Buttons */}
      {hasOAuth ? (
        <OAuthProviderButtons
          providers={oauthProviders}
          projectInviteToken={projectInviteToken}
          githubLabel={t('continue_with_github')}
          googleLabel={t('continue_with_google')}
        />
      ) : null}

      {/* Divider */}
      {hasOAuth ? (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2.5 text-[#525252]">{t('or_continue_with_email')}</span>
          </div>
        </div>
      ) : null}

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="auth-carbon-label">
            {t('full_name_label')}
          </Label>
          <Input
            id="name"
            type="text"
            className="auth-carbon-input"
            placeholder={t('full_name_placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="auth-carbon-label">
            {t('email_label')}
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
          <Label htmlFor="password" className="auth-carbon-label">
            {t('password_label')}
          </Label>
          <Input
            id="password"
            type="password"
            className="auth-carbon-input"
            placeholder={t('password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-[#525252]">{t('password_hint')}</p>
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
          {loading ? t('creating_account') : t('create_account_submit')}
        </Button>

        <p className="text-xs leading-5 text-[#525252]">
          {t.rich('terms_agreement', {
            terms: (chunks) => (
              <Link href="/terms" className="auth-carbon-link">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="auth-carbon-link">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>

      {/* Sign In Link */}
      <p className="text-sm text-[#525252]">
        {t('have_account')}{' '}
        <Link
          href={
            projectInviteToken
              ? `/auth/signin?projectInviteToken=${encodeURIComponent(projectInviteToken)}`
              : '/auth/signin'
          }
          className="auth-carbon-link"
        >
          {t('signin')}
        </Link>
      </p>
    </div>
  );
}

function getSignupErrorMessage(data: SignupResponse, t: (key: SignupErrorKey) => string) {
  const code = data.code || data.error;
  if (code === 'REGISTRATION_INVITE_REQUIRED') {
    return t('registration_invite_required');
  }
  if (code === 'REGISTRATION_ADMIN_ONLY') {
    return t('registration_admin_only');
  }
  if (code === 'INVALID_PROJECT_INVITE') {
    return t('project_invite_invalid');
  }
  return data.error || t('signup_failed');
}
