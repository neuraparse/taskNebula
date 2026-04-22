import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { AppUiScope } from '@/components/layout/app-ui-scope';
import { RouteTransition } from '@/components/layout/route-transition';
import { PageSidebarSlotProvider } from '@/components/layout/page-sidebar-slot';
import { GlobalVoiceProvider } from '@/components/chat/global-voice-provider';
import { CommandPaletteProvider } from '@/components/command/command-palette-provider';
import { KeyboardShortcutsProvider } from '@/components/help/keyboard-shortcuts-provider';
import { AiSidecarProvider } from '@/components/ai/ai-sidecar-provider';

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalVoiceProvider>
      <AppUiScope />
      <CommandPaletteProvider>
        <KeyboardShortcutsProvider>
          <AiSidecarProvider>
            <PageSidebarSlotProvider>
              <div className="app-square-ui flex h-screen overflow-hidden bg-background">
                <AppSidebar />

                <div className="flex flex-1 flex-col overflow-hidden">
                  <AppHeader />

                  <main className="flex-1 overflow-auto">
                    <RouteTransition>{children}</RouteTransition>
                  </main>
                </div>
              </div>
            </PageSidebarSlotProvider>
          </AiSidecarProvider>
        </KeyboardShortcutsProvider>
      </CommandPaletteProvider>
    </GlobalVoiceProvider>
  );
}
