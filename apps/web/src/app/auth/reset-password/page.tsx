import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import Link from 'next/link';

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

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
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-6 stagger">
              <div className="text-center space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Invalid reset link
                </h1>
                <p className="text-sm text-muted-foreground">
                  Invalid or missing reset link. Please request a new one.
                </p>
              </div>
              <div className="text-center">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150 ease-snap"
                >
                  Request a new reset link
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
