/**
 * Root App Router not-found page.
 *
 * Rendered when a route segment calls `notFound()` or a path does not match
 * any segment. Keep this server-rendered for SEO friendliness.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function NotFound() {
  const t = await getTranslations('errorPages');

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-muted-foreground mb-2 flex items-center gap-2">
            <Compass className="h-5 w-5" aria-hidden />
            <CardTitle>{t('notFound.title')}</CardTitle>
          </div>
          <CardDescription>{t('notFound.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('notFound.hint')}</p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="default">
            <Link href="/">{t('notFound.backToHome')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
