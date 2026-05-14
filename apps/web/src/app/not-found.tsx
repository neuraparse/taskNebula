/**
 * Root App Router not-found page.
 *
 * Rendered when a route segment calls `notFound()` or a path does not match
 * any segment. Keep this server-rendered for SEO friendliness.
 */

import Link from 'next/link';
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

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Compass className="h-5 w-5" aria-hidden />
            <CardTitle>Page not found</CardTitle>
          </div>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Double-check the URL, or head back to your workspace.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="default">
            <Link href="/">Back to home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
