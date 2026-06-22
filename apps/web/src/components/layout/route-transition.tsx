'use client';

import { ReactNode } from 'react';

export function RouteTransition({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}
