'use client';

import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background px-4">
      <div className="panel-warn animate-fade-up flex w-full max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-accent-amber">
        <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm text-foreground">You&rsquo;re offline.</p>
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          variant="outline"
          className="rounded-md"
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
