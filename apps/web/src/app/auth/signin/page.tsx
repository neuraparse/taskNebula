import { SignInForm } from '@/components/auth/signin-form';
import Link from 'next/link';

// signin form reads query params (verified=1, reset=1, error=...) via useSearchParams,
// which requires either a Suspense boundary or opting out of static prerender.
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden px-4">
      {/* Aurora glow behind card */}
      <div
        aria-hidden="true"
        className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
      />

      <div className="relative w-full max-w-sm animate-blur-in">
        {/* Brand mark */}
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
              <span className="text-[11px] font-semibold tracking-tight text-background">TN</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">TaskNebula</span>
          </Link>
        </div>

        <div className="surface-card rounded-lg p-6 sm:p-8">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
