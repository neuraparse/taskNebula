'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push('/auth/signin?reset=1');
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || 'Failed to reset password. The link may be invalid or expired.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 stagger">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Password reset
          </h1>
          <p className="text-sm text-muted-foreground">
            Password reset — redirecting to sign in
          </p>
        </div>

        <div className="flex items-center justify-center py-2">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
            aria-label="Redirecting"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="Enter a new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
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
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </form>

      {/* Back to Sign In */}
      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link
          href="/auth/signin"
          className="font-medium text-foreground hover:text-primary transition-colors duration-150 ease-snap"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
