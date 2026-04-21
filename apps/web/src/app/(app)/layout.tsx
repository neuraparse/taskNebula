import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { AppUiScope } from '@/components/layout/app-ui-scope';
import { RouteTransition } from '@/components/layout/route-transition';
import { CommandPalette } from '@/components/command-palette';
import { GlobalVoiceProvider } from '@/components/chat/global-voice-provider';

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalVoiceProvider>
      <AppUiScope />
      <div className="app-square-ui flex h-screen overflow-hidden bg-background">
        {/* Command Palette - Global */}
        <CommandPalette />

        {/* Left Sidebar */}
        <AppSidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <AppHeader />

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <RouteTransition>{children}</RouteTransition>
          </main>
        </div>
      </div>
    </GlobalVoiceProvider>
  );
}
