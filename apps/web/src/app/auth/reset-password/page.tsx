import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthIntro } from '@/components/auth/auth-ui';
import { Button } from '@/components/ui/button';
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
        <div className="animate-fade-up space-y-7">
          <AuthIntro
            title={t('resetPassword.invalidTitle')}
            description={t('resetPassword.invalidBody')}
          />
          <Button asChild className="w-full text-sm" size="xl">
            <Link href="/auth/forgot-password">{t('resetPassword.requestNew')}</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
