'use client';

import { ReactNode } from 'react';
import { SessionProvider } from './session-provider';
import { ThemeProvider } from './theme-provider';
import { QueryProvider } from './query-provider';
import { ThemeInitializer } from './theme-initializer';
import { DeploymentReloadGuard } from './deployment-reload-guard';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DeploymentReloadGuard />
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ThemeInitializer />
          {children}
        </ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
