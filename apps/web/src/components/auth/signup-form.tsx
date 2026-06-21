'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

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
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [projectInviteToken, setProjectInviteToken] = useState<string | null>(null);

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

  const handleGitHubSignIn = async () => {
    await signIn('github', { callbackUrl: getPostAuthUrl(projectInviteToken) });
  };

  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: getPostAuthUrl(projectInviteToken) });
  };

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          aria-label={t('loading')}
        />
      </div>
    );
  }

  return (
    <div className="stagger space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('create_account_title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('create_account_subtitle')}</p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={handleGitHubSignIn}
          type="button"
          className="ease-snap w-full transition-all duration-150"
          size="lg"
        >
          <Github className="mr-2 h-4 w-4" />
          {t('continue_with_github')}
        </Button>
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          type="button"
          className="ease-snap w-full transition-all duration-150"
          size="lg"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
          {t('continue_with_google')}
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-2.5">
            {t('or_continue_with_email')}
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('full_name_label')}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t('full_name_placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email_label')}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t('password_label')}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t('password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-muted-foreground text-xs">{t('password_hint')}</p>
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
          {loading ? t('creating_account') : t('create_account_submit')}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          {t.rich('terms_agreement', {
            terms: (chunks) => (
              <Link
                href="/terms"
                className="hover:text-foreground ease-snap underline transition-colors duration-150"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="hover:text-foreground ease-snap underline transition-colors duration-150"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>

      {/* Sign In Link */}
      <p className="text-muted-foreground text-center text-sm">
        {t('have_account')}{' '}
        <Link
          href={
            projectInviteToken
              ? `/auth/signin?projectInviteToken=${encodeURIComponent(projectInviteToken)}`
              : '/auth/signin'
          }
          className="text-foreground hover:text-primary ease-snap font-medium transition-colors duration-150"
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

function getPostAuthUrl(projectInviteToken: string | null) {
  return projectInviteToken
    ? `/join/project/${encodeURIComponent(projectInviteToken)}`
    : '/dashboard';
}
