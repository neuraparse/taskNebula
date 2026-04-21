'use client';

import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="animate-fade-up text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-5">
            <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <p className="text-base text-muted-foreground">No internet connection</p>
        <Button onClick={() => window.location.reload()} size="lg">
          Reload
        </Button>
      </div>
    </div>
  );
}
