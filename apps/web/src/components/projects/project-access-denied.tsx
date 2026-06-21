'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ProjectAccessDeniedProps {
  messageKey?: 'noProjectPermission' | 'noSprintPermission';
}

export function ProjectAccessDenied({
  messageKey = 'noProjectPermission',
}: ProjectAccessDeniedProps) {
  const t = useTranslations('pagesProjects');

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Lock className="text-muted-foreground h-12 w-12" />
      <div className="text-lg font-medium">{t('accessDenied')}</div>
      <div className="text-muted-foreground max-w-md text-sm">{t(messageKey)}</div>
      <Button asChild variant="outline">
        <Link href="/projects">{t('backToProjects')}</Link>
      </Button>
    </div>
  );
}
