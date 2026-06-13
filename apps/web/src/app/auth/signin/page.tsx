import { SignInForm } from '@/components/auth/signin-form';
import Link from 'next/link';

// signin form reads query params (verified=1, reset=1, error=...) via useSearchParams,
// which requires either a Suspense boundary or opting out of static prerender.
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* Aurora glow behind card */}
      <div
        aria-hidden="true"
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
      />

      <div className="animate-blur-in relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="ease-snap focus-visible:ring-ring flex items-center gap-2 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <div className="bg-foreground flex h-7 w-7 items-center justify-center rounded-md">
              <span className="text-background text-[11px] font-semibold tracking-tight">
                {'TN'}
              </span>
            </div>
            <span className="text-foreground text-sm font-semibold tracking-tight">
              {'TaskNebula'}
            </span>
          </Link>
        </div>

        <div className="surface-card rounded-lg p-6 sm:p-8">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
