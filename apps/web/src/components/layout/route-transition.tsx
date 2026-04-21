'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="flex h-full min-h-0 flex-col animate-page-enter">
      {children}
    </div>
  );
}
