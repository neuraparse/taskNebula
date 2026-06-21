import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const t = await getTranslations('authPages');

  return (
    <AuthShell>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="stagger space-y-6">
          <div className="space-y-2">
            <h1 className="auth-carbon-heading">{t('resetPassword.invalidTitle')}</h1>
            <p className="auth-carbon-subtitle">{t('resetPassword.invalidBody')}</p>
          </div>
          <Link href="/auth/forgot-password" className="auth-carbon-link inline-block text-sm">
            {t('resetPassword.requestNew')}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
