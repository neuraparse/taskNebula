'use client';

import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background px-4">
      <div className="animate-fade-up text-center space-y-5">
        <div className="flex justify-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">You&rsquo;re offline.</p>
        <Button onClick={() => window.location.reload()} size="lg">
          Retry
        </Button>
      </div>
    </div>
  );
}
