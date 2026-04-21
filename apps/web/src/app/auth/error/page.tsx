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
    <div className="text-center space-y-5 stagger">
      <div className="flex justify-center">
        <span className="chip-rose" aria-hidden="true">
          Error · {error}
        </span>
      </div>

      <div className="flex justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Authentication error
        </h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>

      <Button asChild className="w-full transition-all duration-150 ease-snap" size="lg">
        <Link href="/auth/signin">Try again</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
      />

      <div className="relative w-full max-w-sm animate-blur-in">
        <div className="surface-card rounded-lg p-6 sm:p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
                  aria-label="Loading"
                />
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
