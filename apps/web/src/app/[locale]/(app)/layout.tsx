import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { AppUiScope } from '@/components/layout/app-ui-scope';
import { RouteTransition } from '@/components/layout/route-transition';
import { PageSidebarSlotProvider } from '@/components/layout/page-sidebar-slot';
import { GlobalVoiceProvider } from '@/components/chat/global-voice-provider';
import { CommandPaletteProvider } from '@/components/command/command-palette-provider';
import { KeyboardShortcutsProvider } from '@/components/help/keyboard-shortcuts-provider';
import { AiSidecarProvider } from '@/components/ai/ai-sidecar-provider';
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner';
import { MobileNav } from '@/components/mobile/mobile-nav';
import { GlobalVersionUpdateBanner } from '@/components/admin/global-version-update-banner';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';

type AppCarbonStyle = CSSProperties & {
  '--font-sans': string;
  '--font-mono': string;
};

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [t, showUpdateBanner] = await Promise.all([getTranslations('common'), isSuperAdmin()]);
  const appCarbonStyle = {
    '--font-sans': "var(--app-font-sans, 'Plus Jakarta Sans')",
    '--font-mono': "var(--app-font-mono, 'JetBrains Mono')",
    fontFamily: 'var(--font-sans)',
  } satisfies AppCarbonStyle;

  return (
    <GlobalVoiceProvider>
      <AppUiScope />
      <CommandPaletteProvider>
        <KeyboardShortcutsProvider>
          <AiSidecarProvider>
            <PageSidebarSlotProvider>
              <a
                href="#main-content"
                className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
              >
                {t('skipToContent')}
              </a>
              <div
                className="app-square-ui bg-surface text-foreground flex h-dvh overflow-hidden"
                style={appCarbonStyle}
              >
                <div className="hidden md:flex">
                  <AppSidebar />
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Rendered async; returns null when the user is verified. */}
                  <EmailVerificationBanner />
                  <div className="hidden md:block">
                    <AppHeader />
                  </div>
                  {showUpdateBanner ? <GlobalVersionUpdateBanner /> : null}

                  <main
                    id="main-content"
                    tabIndex={-1}
                    className="flex-1 overflow-auto pb-16 focus:outline-none md:pb-0"
                  >
                    <RouteTransition>{children}</RouteTransition>
                  </main>
                </div>
                <MobileNav />
              </div>
            </PageSidebarSlotProvider>
          </AiSidecarProvider>
        </KeyboardShortcutsProvider>
      </CommandPaletteProvider>
    </GlobalVoiceProvider>
  );
}
