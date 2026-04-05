'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Inbox,
  FolderKanban,
  BookOpenText,
  Users,
  Settings,
  ChevronDown,
  Plus,
  Shield,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Users2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useProjects } from '@/lib/hooks/use-projects';
import { useLiveCalls } from '@/lib/hooks/use-chat';
import { useGlobalVoice } from '@/components/chat/global-voice-provider';

const navigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'My Issues', href: '/my-issues', icon: Inbox },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Docs', href: '/docs', icon: BookOpenText },
  { name: 'Team', href: '/team', icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { data: liveCalls, isLoading: liveCallsLoading } = useLiveCalls();
  const {
    connectionState,
    currentSession,
    currentTarget,
    endCurrentCall,
    isMicrophoneEnabled,
    isTogglingMicrophone,
    leaveCurrentCall,
    participantCount,
    runtimeError,
    toggleMicrophone,
  } = useGlobalVoice();

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/user/me');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const { data: projects, isLoading: projectsLoading } = useProjects();

  const isSuperAdmin = userData?.isSuperAdmin || false;
  const pinnedCall = currentTarget
    ? liveCalls?.find((call) => call.roomId === currentTarget.roomId && call.participantCount > 0) || null
    : null;
  const otherActiveCalls = (liveCalls || [])
    .filter((call) => call.roomId !== currentTarget?.roomId && call.participantCount > 0)
    .slice(0, 3);
  const effectiveParticipantCount = Math.max(
    pinnedCall?.participantCount ?? 0,
    currentSession && connectionState === 'connected' ? Math.max(participantCount, 1) : 0
  );
  const isCallConnecting = currentSession && connectionState !== 'connected';
  const selectedRoomId = searchParams.get('roomId');
  const currentCallRoomPath = currentTarget?.roomHref.split('?')[0] || null;
  const isViewingCurrentCallRoom = Boolean(
    currentTarget &&
      currentCallRoomPath &&
      pathname === currentCallRoomPath &&
      selectedRoomId === currentTarget.roomId
  );
  const sidebarRuntimeError = isViewingCurrentCallRoom ? null : runtimeError;
  const voiceStatusLabel = !currentSession
    ? null
    : isCallConnecting
      ? 'Connecting…'
      : isMicrophoneEnabled
        ? 'Mic live'
        : 'Muted';

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      {/* Organization Selector */}
      <div className="border-b border-border p-3">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium hover:bg-accent transition-colors">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="font-semibold text-foreground">TaskNebula</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Projects Section */}
        <div className="pt-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <Link href="/projects">
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.slice(0, 5).map((project) => {
                const projectPath = project.key?.toLowerCase() || project.id;
                const isActive = pathname?.includes(`/projects/${projectPath}`);
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${projectPath}/board`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors group',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {project.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {project.key}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="px-2 py-4 text-center">
                <p className="text-xs text-muted-foreground">No projects yet</p>
              </div>
            )}
            {projects && projects.length > 5 && (
              <Link
                href="/projects"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                View all {projects.length} projects
              </Link>
            )}
          </div>
        </div>
      </nav>

      {currentTarget || otherActiveCalls.length > 0 || sidebarRuntimeError ? (
        <div className="border-t border-border p-2 space-y-1.5">
          <div className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.16em]">
            Live Calls
          </div>

          {currentTarget ? (
            <div className="rounded-sm border bg-muted/15 p-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full shrink-0',
                    isCallConnecting ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-foreground">
                    {currentTarget.roomTitle}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {currentTarget.projectName}
                    {effectiveParticipantCount ? ` · ${effectiveParticipantCount} in call` : ''}
                  </div>
                </div>
                <span className="rounded-sm border px-1 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  live
                </span>
              </div>
              <div className="space-y-1 rounded-sm border bg-background/60 px-2 py-1.5">
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground">Voice</span>
                  <span className="truncate text-muted-foreground">{voiceStatusLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link href={currentTarget.roomHref} className="flex-1 min-w-0">
                  <Button size="sm" variant="outline" className="h-6 w-full rounded-sm px-2 text-[11px]">
                    <PhoneCall className="mr-1 h-3 w-3" />
                    Room
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 rounded-sm px-0"
                  onClick={() => void toggleMicrophone()}
                  disabled={!currentSession || isCallConnecting || isTogglingMicrophone}
                  title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isTogglingMicrophone ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isMicrophoneEnabled ? (
                    <MicOff className="h-3 w-3" />
                  ) : (
                    <Mic className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 rounded-sm px-0"
                  onClick={() => void leaveCurrentCall()}
                  title="Leave call"
                  aria-label="Leave call"
                >
                  <PhoneOff className="h-3 w-3" />
                </Button>
              </div>
              {currentTarget.canManageCalls ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-full rounded-sm px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => void endCurrentCall()}
                >
                  End room for everyone
                </Button>
              ) : null}
            </div>
          ) : null}

          {sidebarRuntimeError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              {sidebarRuntimeError}
            </div>
          ) : null}

          {liveCallsLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking active calls…
            </div>
          ) : null}

          {otherActiveCalls.map((call) => (
            <Link
              key={call.id}
              href={call.room.href}
              className="flex items-center gap-1.5 rounded-sm border px-2 py-1 text-left transition-colors hover:bg-accent"
            >
              <Radio className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-foreground">{call.room.title}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {call.project.key} · {call.participantCount}
                  {call.isParticipant ? ' · joined' : ''}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-sm border px-1 py-0.5 text-[9px] text-muted-foreground">
                <Users2 className="h-2.5 w-2.5 shrink-0" />
                <span>{call.participantCount}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {/* User Profile & Settings */}
      <div className="border-t border-border p-2 space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              pathname === '/admin'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </Link>
        )}

        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors cursor-pointer">
          <Avatar className="h-6 w-6">
            {session?.user?.image && <AvatarImage src={session.user.image} />}
            <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
              {session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">
              {session?.user?.name || 'User'}
            </p>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      </div>
    </aside>
  );
}
