'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="flex justify-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Authentication error</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
      <Button asChild className="w-full" size="lg">
        <Link href="/auth/signin">Try again</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center px-4">
      {/* Aurora background */}
      <div className="bg-aurora absolute inset-0 pointer-events-none animate-aurora opacity-80" />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <div className="surface-card p-8 shadow-lg rounded-xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              </div>
            }
          >
            <ErrorContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
