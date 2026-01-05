'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Crown, Briefcase, Users, Shield, Code, Bug, Palette, Eye } from 'lucide-react';
import Link from 'next/link';

// Demo users
const DEMO_USERS = [
  { email: 'admin@tasknebula.io', role: 'Admin', icon: Crown },
  { email: 'po@tasknebula.io', role: 'Product Owner', icon: Briefcase },
  { email: 'sm@tasknebula.io', role: 'Scrum Master', icon: Users },
  { email: 'lead@tasknebula.io', role: 'Tech Lead', icon: Shield },
  { email: 'dev1@tasknebula.io', role: 'Developer', icon: Code },
  { email: 'qa@tasknebula.io', role: 'QA Engineer', icon: Bug },
  { email: 'design@tasknebula.io', role: 'Designer', icon: Palette },
  { email: 'viewer@tasknebula.io', role: 'Viewer', icon: Eye },
];

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

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
    } catch (err) {
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

  const handleDemoLogin = async (userEmail: string) => {
    setError('');
    setLoadingDemo(userEmail);

    try {
      const result = await signIn('credentials', {
        email: userEmail,
        password: 'demo123',
        redirect: false,
      });

      if (result?.error) {
        setError('Demo login failed. Please ensure seed data is loaded.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoadingDemo(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="mb-2 text-[28px] font-semibold tracking-tight">Sign in to TaskNebula</h1>
        <p className="text-[15px] text-muted-foreground">
          Welcome back. Please enter your details.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* OAuth Buttons */}
        <div className="space-y-2.5">
          <Button
            variant="outline"
            onClick={handleGitHubSignIn}
            type="button"
            className="h-11 w-full text-[15px] font-medium"
          >
            <Github className="mr-2.5 h-[18px] w-[18px]" />
            Continue with GitHub
          </Button>
          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            type="button"
            className="h-11 w-full text-[15px] font-medium"
          >
            <svg className="mr-2.5 h-[18px] w-[18px]" viewBox="0 0 24 24">
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
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2.5 text-muted-foreground">Or continue with email</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 text-[15px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password
              </Label>
              <Link
                href="/auth/forgot-password"
                className="text-[13px] text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 text-[15px]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="h-11 w-full text-[15px] font-medium" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {/* Demo Accounts */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2.5 text-muted-foreground">Demo accounts</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map((user) => {
              const Icon = user.icon;
              const isLoading = loadingDemo === user.email;
              return (
                <button
                  key={user.email}
                  onClick={() => handleDemoLogin(user.email)}
                  disabled={loadingDemo !== null}
                  className="flex items-center gap-2.5 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{user.role}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
                  </div>
                  {isLoading && (
                    <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Up Link */}
        <div className="text-center">
          <span className="text-[14px] text-muted-foreground">Don't have an account? </span>
          <Link href="/auth/signup" className="text-[14px] font-medium hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
