import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const t = await getTranslations('authPages');

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
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="stagger space-y-6">
              <div className="space-y-1.5 text-center">
                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                  {t('resetPassword.invalidTitle')}
                </h1>
                <p className="text-muted-foreground text-sm">{t('resetPassword.invalidBody')}</p>
              </div>
              <div className="text-center">
                <Link
                  href="/auth/forgot-password"
                  className="text-foreground hover:text-primary ease-snap text-sm font-medium transition-colors duration-150"
                >
                  {t('resetPassword.requestNew')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
