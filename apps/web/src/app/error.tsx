'use client';

/**
 * Per-route App Router error boundary.
 *
 * Rendered by Next.js when a Server Component (or React render error) bubbles
 * up inside a route segment. The route still has access to layouts, so the
 * shell, sidebar etc. remain visible — only the failing segment is replaced.
 *
 * NOTE: this file MUST be a Client Component (`use client`). Errors thrown in
 * Server Components are passed in serialised; the `digest` is the only safe
 * correlation id to share with users.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errorPages');

  useEffect(() => {
    // Surface the failure for client-side observability. Server-side this
    // error was already logged by the route handler / RSC pipeline.
    // Using console.error here is deliberate: pino is server-only.
    // eslint-disable-next-line no-console
    console.error('Route boundary caught error', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-destructive mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            <CardTitle>{t('error.title')}</CardTitle>
          </div>
          <CardDescription>{t('error.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error.digest && (
            <p className="text-muted-foreground text-xs">
              {t('error.reference')} <code className="font-mono">{error.digest}</code>
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t('error.tryAgain')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t('error.goHome')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
