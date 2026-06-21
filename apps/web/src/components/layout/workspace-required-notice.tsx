import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';

export async function WorkspaceRequiredNotice() {
  const [t, tNav] = await Promise.all([getTranslations('pagesProjects'), getTranslations('nav')]);

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="surface-card w-full max-w-lg space-y-4 p-8 text-center">
        <LockKeyhole className="text-muted-foreground mx-auto h-8 w-8" />
        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">{t('projectInviteRequiredTitle')}</p>
          <p className="text-muted-foreground text-sm">{t('projectInviteRequiredDescription')}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings">{tNav('settings')}</Link>
        </Button>
      </div>
    </div>
  );
}
