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
  AUTH_INPUT_CLASS_NAME,
  AUTH_LINK_CLASS_NAME,
  AUTH_STANDALONE_LINK_CLASS_NAME,
  AuthDivider,
  AuthFieldError,
  AuthFormAlert,
  AuthIntro,
  AuthLoading,
} from './auth-ui';
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
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
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
    setPasswordError('');
    setFormError('');

    if (password.length < 8) {
      setPasswordError(t('password_min_length'));
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
        setFormError(getSignupErrorMessage(data, t));
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
    } catch {
      setFormError(t('generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const hasOAuth = hasOAuthProviders(oauthProviders);

  if (checkingSetup) {
    return <AuthLoading label={t('loading')} />;
  }

  return (
    <div className="animate-fade-up space-y-7">
      <AuthIntro title={t('create_account_title')} description={t('create_account_subtitle')} />

      {hasOAuth ? (
        <OAuthProviderButtons
          providers={oauthProviders}
          projectInviteToken={projectInviteToken}
          githubLabel={t('continue_with_github')}
          googleLabel={t('continue_with_google')}
        />
      ) : null}

      {hasOAuth ? <AuthDivider>{t('or_continue_with_email')}</AuthDivider> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">{t('full_name_label')}</Label>
          <Input
            id="name"
            type="text"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={t('full_name_placeholder')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (formError) setFormError('');
            }}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('email_label')}</Label>
          <Input
            id="email"
            type="email"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={tAuth('email_placeholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError('');
            }}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('password_label')}</Label>
          <Input
            id="password"
            type="password"
            className={AUTH_INPUT_CLASS_NAME}
            placeholder={t('password_placeholder')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError('');
              if (formError) setFormError('');
            }}
            required
            autoComplete="new-password"
            aria-invalid={!!passwordError}
            aria-describedby={
              passwordError ? 'signup-password-hint signup-password-error' : 'signup-password-hint'
            }
          />
          <p id="signup-password-hint" className="text-muted-foreground text-xs leading-5">
            {t('password_hint')}
          </p>
          {passwordError ? (
            <AuthFieldError id="signup-password-error">{passwordError}</AuthFieldError>
          ) : null}
        </div>

        {formError ? <AuthFormAlert id="signup-form-error">{formError}</AuthFormAlert> : null}

        <Button type="submit" className="w-full text-sm" size="xl" disabled={loading}>
          {loading ? t('creating_account') : t('create_account_submit')}
        </Button>

        <p className="text-muted-foreground text-xs leading-5">
          {t.rich('terms_agreement', {
            terms: (chunks) => (
              <Link href="/terms" className={AUTH_LINK_CLASS_NAME} prefetch={false}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className={AUTH_LINK_CLASS_NAME} prefetch={false}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
        <span>{t('have_account')}</span>
        <Link
          href={
            projectInviteToken
              ? `/auth/signin?projectInviteToken=${encodeURIComponent(projectInviteToken)}`
              : '/auth/signin'
          }
          className={AUTH_STANDALONE_LINK_CLASS_NAME}
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
  return t('signup_failed');
}
