'use client';

import type { ReactNode } from 'react';
import { DirectionProvider as RadixDirectionProvider } from '@radix-ui/react-direction';

/**
 * Thin client wrapper around Radix' `DirectionProvider`.
 *
 * Radix' provider relies on React context, so it cannot be rendered
 * directly from a server component (Next.js will fail to collect page
 * data with "createContext is not a function"). This module is marked
 * `'use client'` to give it a client boundary, while leaving the parent
 * layout free to stay server-rendered.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: 'ltr' | 'rtl';
  children: ReactNode;
}) {
  return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}
