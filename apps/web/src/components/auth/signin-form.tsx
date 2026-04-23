'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, Github, KeyRound, MailCheck, X } from 'lucide-react';
import Link from 'next/link';

type BannerTone = 'success' | 'warn' | 'danger';

type StatusBanner = {
  key: string;
  tone: BannerTone;
  icon: ComponentType<{ className?: string }>;
  message: string;
};

function resolveStatusBanner(params: URLSearchParams | null): StatusBanner | null {
  if (!params) return null;

  if (params.get('verified') === '1') {
    return {
      key: 'verified',
      tone: 'success',
      icon: MailCheck,
      message: 'Email verified. Sign in to continue.',
    };
  }

  if (params.get('reset') === '1') {
    return {
      key: 'reset',
      tone: 'success',
      icon: KeyRound,
      message: 'Password updated. Sign in with your new password.',
    };
  }

  const errorParam = params.get('error');
  if (errorParam === 'CredentialsSignin') {
    return {
      key: 'error-credentials',
      tone: 'danger',
      icon: AlertCircle,
      message: 'Incorrect email or password.',
    };
  }
  if (errorParam === 'Verification') {
    return {
      key: 'error-verification',
      tone: 'warn',
      icon: AlertTriangle,
      message: 'That verification link is no longer valid.',
    };
  }
  if (errorParam) {
    return {
      key: `error-${errorParam}`,
      tone: 'danger',
      icon: AlertCircle,
      message: 'Something went wrong while signing in.',
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
        setError('Invalid email or password');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
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
          className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      {/* Status banner (verify / reset / error query params) */}
      {activeBanner && (
        <div
          key={activeBanner.key}
          role={activeBanner.tone === 'success' ? 'status' : 'alert'}
          className={`${BANNER_TONE_STYLES[activeBanner.tone]} animate-alert-in flex items-start gap-3 px-3 py-2.5 text-sm`}
        >
          <activeBanner.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-snug text-foreground">{activeBanner.message}</p>
          <button
            type="button"
            onClick={() => setDismissedBannerKey(activeBanner.key)}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors duration-150 ease-snap hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Dismiss notification"
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
          className="w-full transition-all duration-150 ease-snap"
          size="lg"
        >
          <Github className="mr-2 h-4 w-4" />
          Continue with GitHub
        </Button>
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full transition-all duration-150 ease-snap"
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
          Continue with Google
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2.5 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 ease-snap"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
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
          className="w-full transition-all duration-150 ease-snap"
          size="lg"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Sign Up Link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/signup"
          className="font-medium text-foreground hover:text-primary transition-colors duration-150 ease-snap"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
