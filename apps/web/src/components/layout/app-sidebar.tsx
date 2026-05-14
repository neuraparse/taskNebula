'use client';

import type { Participant } from 'livekit-client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  RoomContext,
  useAudioPlayback,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import {
  Home,
  Inbox,
  FolderKanban,
  BookOpenText,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Shield,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Users2,
  Volume2,
  Activity,
  Bell,
  Building2,
  Eye,
  FileText,
  KeyRound,
  Palette,
  Pin,
  Plug,
  Sparkles,
  Star,
  UserCog,
  UserPlus,
  Webhook,
  Workflow,
} from 'lucide-react';
import { Bot, Flag, Gauge, MessageSquareText, Scroll, ScrollText } from 'lucide-react';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamspaceSwitcher } from '@/components/organization/teamspace-switcher';
import { AppRail } from '@/components/layout/app-rail';
import {
  PageSidebarSlotTarget,
  usePageSidebarHasContent,
} from '@/components/layout/page-sidebar-slot';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useProjects } from '@/lib/hooks/use-projects';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useLiveCalls } from '@/lib/hooks/use-chat';
import {
  useOrganizationPermissions,
  type Permission,
} from '@/lib/hooks/use-permissions';
import { useGlobalVoice } from '@/components/chat/global-voice-provider';
import {
  areMicrophoneDeviceLabelsVisible,
  formatMicrophoneError,
  formatMicrophonePermissionStateLabel,
  getMicrophonePermissionHelpMessage,
  getMicrophonePermissionState,
  listAudioInputDevices,
  normalizeAudioInputDeviceId,
  requestMicrophonePermission,
  resolvePreferredAudioInputDevice,
  type MicrophoneDeviceOption,
  type MicrophonePermissionState,
} from '@/lib/chat/microphone';
import { useStoredVoicePreferences } from '@/lib/chat/voice-preferences';

const MY_ISSUES_VIEWS = [
  { value: 'assigned', label: 'Assigned to me', icon: Inbox },
  { value: 'created', label: 'Created by me', icon: UserPlus },
  { value: 'subscribed', label: 'Subscribed', icon: Eye },
  { value: 'mentioned', label: 'Mentioned', icon: Sparkles },
];

const DASHBOARD_LINKS = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/templates', label: 'Templates', icon: Pin },
];

const TEAM_LINKS: NavLink[] = [
  { href: '/team', label: 'Members', icon: Users },
  { href: '/team?tab=teamspaces', label: 'Teamspaces', icon: Building2, requiredPermission: 'team:view' },
  { href: '/team?tab=invites', label: 'Pending invites', icon: UserPlus, requiredPermission: 'member:view' },
];

const SETTINGS_LINKS: NavLink[] = [
  { href: '/settings?tab=organization', label: 'Organization', icon: Building2, match: { path: '/settings', tab: 'organization' }, requiredPermission: 'org:settings' },
  { href: '/settings?tab=members', label: 'Members', icon: Users, match: { path: '/settings', tab: 'members' }, requiredPermission: 'member:view' },
  { href: '/settings?tab=api-keys', label: 'API Keys', icon: KeyRound, match: { path: '/settings', tab: 'api-keys' }, requiredPermission: 'api_key:view' },
  { href: '/settings?tab=webhooks', label: 'Webhooks', icon: Webhook, match: { path: '/settings', tab: 'webhooks' }, requiredPermission: 'webhook:view' },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug, match: { path: '/settings/integrations' }, requiredPermission: 'org:settings' },
  { href: '/settings/intake-forms', label: 'Intake forms', icon: Inbox, match: { path: '/settings/intake-forms' }, requiredPermission: 'org:settings' },
  { href: '/settings?tab=ai-agents', label: 'AI & Agents', icon: Bot, match: { path: '/settings', tab: 'ai-agents' }, requiredPermission: 'org:settings' },
  { href: '/settings?tab=communications', label: 'Communications', icon: MessageSquareText, match: { path: '/settings', tab: 'communications' }, requiredPermission: 'org:settings' },
  { href: '/settings?tab=notifications', label: 'Notifications', icon: Bell, match: { path: '/settings', tab: 'notifications' } },
  { href: '/settings?tab=appearance', label: 'Appearance', icon: Palette, match: { path: '/settings', tab: 'appearance' } },
  { href: '/settings?tab=audit-log', label: 'Activity', icon: ScrollText, match: { path: '/settings', tab: 'audit-log' }, requiredPermission: 'org:manage' },
];

const ADMIN_LINKS = [
  { href: '/admin?tab=overview', label: 'Overview', icon: Gauge, match: { path: '/admin', tab: 'overview' } },
  { href: '/admin?tab=organizations', label: 'Organizations', icon: Building2, match: { path: '/admin', tab: 'organizations' } },
  { href: '/admin?tab=users', label: 'Users', icon: UserCog, match: { path: '/admin', tab: 'users' } },
  { href: '/admin?tab=feature-flags', label: 'Feature flags', icon: Flag, match: { path: '/admin', tab: 'feature-flags' } },
  { href: '/admin?tab=agents', label: 'Agent control', icon: Bot, match: { path: '/admin', tab: 'agents' } },
  { href: '/admin?tab=realtime', label: 'Realtime health', icon: Radio, match: { path: '/admin', tab: 'realtime' } },
  { href: '/admin?tab=audit', label: 'Audit logs', icon: Scroll, match: { path: '/admin', tab: 'audit' } },
];

type NavLink = {
  href: string;
  label: string;
  icon: typeof Settings;
  match?: { path: string; tab?: string };
  requiredPermission?: Permission;
};

const DEFAULT_TAB_BY_PATH: Record<string, string> = {
  '/settings': 'organization',
  '/admin': 'overview',
};

function isNavLinkActive(
  link: NavLink,
  pathname: string | null | undefined,
  activeTab: string | null | undefined
): boolean {
  if (!link.match) return pathname === link.href;
  if (pathname !== link.match.path) return false;
  if (!link.match.tab) return !activeTab;
  const defaultTab = DEFAULT_TAB_BY_PATH[link.match.path];
  if (link.match.tab === defaultTab) {
    return !activeTab || activeTab === defaultTab;
  }
  return activeTab === link.match.tab;
}

function getSectionLabel(pathname: string | null | undefined): string {
  if (!pathname) return 'Workspace';
  if (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/drafts') ||
    pathname.startsWith('/templates')
  )
    return 'Home';
  if (pathname.startsWith('/my-issues') || pathname.startsWith('/issues')) return 'My Issues';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/docs')) return 'Docs';
  if (pathname.startsWith('/team')) return 'Team';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Workspace';
}

function isHomeSectionPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/drafts') ||
    pathname.startsWith('/templates')
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const { data: liveCalls, isLoading: liveCallsLoading } = useLiveCalls();
  const hasPageSidebar = usePageSidebarHasContent();
  const [isTeamspacesOpen, setIsTeamspacesOpen] = useState(true);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isLiveCallsOpen, setIsLiveCallsOpen] = useState(true);
  const {
    connectionState,
    currentSession,
    currentTarget,
    endCurrentCall,
    isMicrophoneEnabled,
    isTogglingMicrophone,
    leaveCurrentCall,
    participantCount,
    room,
    runtimeError,
    setAudioDeviceId,
    toggleMicrophone,
  } = useGlobalVoice();
  const {
    storedAudioDeviceGroupId,
    storedAudioDeviceId,
    storedAudioDeviceLabel,
    storeAudioDeviceId,
    storeAudioDevicePreference,
  } = useStoredVoicePreferences();
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const autoOpenedRoomIdRef = useRef<string | null>(null);

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/user/me');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const { data: projects, isLoading: projectsLoading } = useProjects({
    organizationId: currentOrganizationId,
    teamId: currentTeamId,
  });

  const isSuperAdmin = userData?.isSuperAdmin || false;

  const {
    has: hasOrgPermission,
    isLoading: isLoadingOrgPermissions,
  } = useOrganizationPermissions(currentOrganizationId ?? undefined);

  const visibleSettingsLinks = useMemo(() => {
    // While loading, render the full list to avoid flicker.
    if (isLoadingOrgPermissions) return SETTINGS_LINKS;
    return SETTINGS_LINKS.filter(
      (link) => !link.requiredPermission || hasOrgPermission(link.requiredPermission)
    );
  }, [hasOrgPermission, isLoadingOrgPermissions]);

  const visibleTeamLinks = useMemo(() => {
    if (isLoadingOrgPermissions) return TEAM_LINKS;
    return TEAM_LINKS.filter(
      (link) => !link.requiredPermission || hasOrgPermission(link.requiredPermission)
    );
  }, [hasOrgPermission, isLoadingOrgPermissions]);
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
  const selectedAudioDeviceId = normalizeAudioInputDeviceId(
    currentSession?.audioDeviceId ?? storedAudioDeviceId
  );

  useEffect(() => {
    if (!currentTarget?.roomId) {
      setIsVoiceSettingsOpen(false);
      autoOpenedRoomIdRef.current = null;
      return;
    }

    if (autoOpenedRoomIdRef.current === currentTarget.roomId) {
      return;
    }

    autoOpenedRoomIdRef.current = currentTarget.roomId;
    setIsVoiceSettingsOpen(true);
  }, [currentTarget?.roomId]);

  const handleChangeAudioDevice = useCallback(
    async (audioDeviceId: string) => {
      const normalizedDeviceId = normalizeAudioInputDeviceId(audioDeviceId);
      if (currentSession) {
        await setAudioDeviceId(normalizedDeviceId);
      }
      storeAudioDeviceId(normalizedDeviceId);
    },
    [currentSession, setAudioDeviceId, storeAudioDeviceId]
  );

  return (
    <div className="flex h-screen">
      <AppRail />
      <aside className="flex w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center px-4">
        <button
          className="flex w-full items-center justify-between rounded-md py-1.5 text-sm font-medium transition-all duration-150 ease-snap hover:bg-accent/60"
          aria-label="Switch workspace"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <TaskNebulaLogo compact className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">TaskNebula</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <nav aria-label="Section" className={cn('flex-1 min-h-0', hasPageSidebar ? 'flex flex-col overflow-hidden' : 'custom-scrollbar overflow-y-auto pb-3')}>
        <PageSidebarSlotTarget className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', !hasPageSidebar && 'hidden')} />

        <div className={cn('px-3', hasPageSidebar && 'hidden')}>
        {pathname?.startsWith('/settings') || pathname?.startsWith('/admin') ? null : (
          <div className="mb-3 mt-1 px-3">
            <div className="kicker">{getSectionLabel(pathname)}</div>
          </div>
        )}

        {pathname?.startsWith('/my-issues') || pathname?.startsWith('/issues') ? (
          <div className="space-y-0.5">
            {MY_ISSUES_VIEWS.map((view) => {
              const isActive =
                pathname?.startsWith('/my-issues') &&
                (searchParams?.get('view') ?? 'assigned') === view.value;
              return (
                <Link
                  key={view.value}
                  href={`/my-issues?view=${view.value}`}
                  data-active={isActive ? 'true' : undefined}
                  className="row-interactive rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground data-[active=true]:text-primary"
                >
                  <view.icon className="h-4 w-4 shrink-0" />
                  <span>{view.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {isHomeSectionPath(pathname) ? (
          <div className="space-y-0.5">
            {DASHBOARD_LINKS.map((link) => {
              const isActive =
                link.href === pathname ||
                (link.href === '/dashboard' && pathname === '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-active={isActive ? 'true' : undefined}
                  className="row-interactive rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground data-[active=true]:text-primary"
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {pathname?.startsWith('/team') ? (
          <div className="space-y-0.5">
            {visibleTeamLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="row-interactive rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground"
              >
                <link.icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {pathname?.startsWith('/settings') || pathname?.startsWith('/admin') ? (
          <>
            {visibleSettingsLinks.length > 0 ? (
              <>
                <div className="mb-1 flex items-center gap-2 px-3">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                  <span className="kicker">Settings</span>
                </div>
                <div className="space-y-0.5">
                  {visibleSettingsLinks.map((link) => {
                    const isActive = isNavLinkActive(link, pathname, searchParams?.get('tab'));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        data-active={isActive ? 'true' : undefined}
                        className="row-interactive rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground data-[active=true]:text-primary"
                      >
                        <link.icon className="h-4 w-4 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}

            {isSuperAdmin ? (
              <>
                <div className="mb-1 mt-4 flex items-center gap-2 px-3">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="kicker">Admin</span>
                </div>
                <div className="space-y-0.5">
                  {ADMIN_LINKS.map((link) => {
                    const isActive = isNavLinkActive(link, pathname, searchParams?.get('tab'));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        data-active={isActive ? 'true' : undefined}
                        className="row-interactive rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground data-[active=true]:text-primary"
                      >
                        <link.icon className="h-4 w-4 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        ) : null}

        <div hidden={!(pathname?.startsWith('/projects') || isHomeSectionPath(pathname))}>
          <button
            type="button"
            onClick={() => setIsTeamspacesOpen((open) => !open)}
            aria-expanded={isTeamspacesOpen}
            className="mb-1 mt-4 flex w-full items-center gap-1 px-3 text-left transition-colors duration-150 hover:text-foreground"
          >
            {isTeamspacesOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="kicker">Teamspaces</span>
          </button>
          {isTeamspacesOpen ? (
            <div className="px-1 pb-2">
              <TeamspaceSwitcher />
            </div>
          ) : null}

          <div className="mb-1 mt-4 flex items-center justify-between px-3">
            <button
              type="button"
              onClick={() => setIsProjectsOpen((open) => !open)}
              aria-expanded={isProjectsOpen}
              className="flex flex-1 items-center gap-1 text-left transition-colors duration-150 hover:text-foreground"
            >
              {isProjectsOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="kicker">Projects</span>
            </button>
            <Link href="/projects">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                aria-label="Create project"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {isProjectsOpen ? (
            <div className="space-y-0.5">
              {projectsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <span role="status" aria-live="polite" aria-busy="true">
                    <span className="sr-only">Loading…</span>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </span>
                </div>
              ) : projects && projects.length > 0 ? (
                projects.slice(0, 5).map((project) => {
                  const projectPath = project.key?.toLowerCase() || project.id;
                  const isActive = pathname?.includes(`/projects/${projectPath}`);
                  const projectIcon = (project as { icon?: string | null }).icon;
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${projectPath}/views`}
                      data-active={isActive ? 'true' : undefined}
                      className="row-interactive group rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground data-[active=true]:text-primary"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted">
                        {projectIcon ? (
                          <span className="text-xs leading-none" aria-hidden="true">
                            {projectIcon}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-muted-foreground">
                            {project.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 truncate">{project.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        {project.key}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground">No projects yet</p>
                </div>
              )}
              {projects && projects.length > 5 ? (
                <Link
                  href="/projects"
                  className="row-interactive rounded-md text-xs text-muted-foreground transition-all duration-150 ease-snap hover:text-foreground"
                >
                  View all {projects.length} projects
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
      </nav>

      {currentTarget || otherActiveCalls.length > 0 || sidebarRuntimeError ? (
        <div className="space-y-1.5 px-3 py-3">
          <button
            type="button"
            onClick={() => setIsLiveCallsOpen((open) => !open)}
            aria-expanded={isLiveCallsOpen}
            className="flex w-full items-center gap-1 text-left transition-colors duration-150 hover:text-foreground"
          >
            {isLiveCallsOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="kicker px-0">Live Calls</span>
          </button>

          {isLiveCallsOpen && currentTarget && currentSession ? (
            room ? (
              <RoomContext.Provider value={room}>
                <SidebarVoiceWorkspace
                  connectionState={connectionState}
                  currentTarget={currentTarget}
                  effectiveParticipantCount={effectiveParticipantCount}
                  isMicrophoneEnabled={isMicrophoneEnabled}
                  isTogglingMicrophone={isTogglingMicrophone}
                  isVoiceSettingsOpen={isVoiceSettingsOpen}
                  runtimeError={sidebarRuntimeError}
                  selectedAudioDeviceId={selectedAudioDeviceId}
                  storedAudioDeviceGroupId={storedAudioDeviceGroupId}
                  storedAudioDeviceLabel={storedAudioDeviceLabel}
                  sessionUserImage={session?.user?.image}
                  sessionUserName={session?.user?.name}
                  onChangeAudioDevice={handleChangeAudioDevice}
                  onStoreAudioDevicePreference={storeAudioDevicePreference}
                  onVoiceSettingsOpenChange={setIsVoiceSettingsOpen}
                  onEndCurrentCall={() => void endCurrentCall()}
                  onLeaveCurrentCall={() => void leaveCurrentCall()}
                  onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                  onToggleMicrophone={() => void toggleMicrophone()}
                />
              </RoomContext.Provider>
            ) : (
              <SidebarVoiceFallbackCard
                connectionState={connectionState}
                currentTarget={currentTarget}
                effectiveParticipantCount={effectiveParticipantCount}
                isMicrophoneEnabled={isMicrophoneEnabled}
                isTogglingMicrophone={isTogglingMicrophone}
                runtimeError={sidebarRuntimeError}
                onEndCurrentCall={() => void endCurrentCall()}
                onLeaveCurrentCall={() => void leaveCurrentCall()}
                onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                onToggleMicrophone={() => void toggleMicrophone()}
              />
            )
          ) : null}

          {isLiveCallsOpen && liveCallsLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking active calls…
            </div>
          ) : null}

          {isLiveCallsOpen
            ? otherActiveCalls.map((call) => (
                <Link
                  key={call.id}
                  href={call.room.href}
                  className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-left transition-all duration-150 ease-snap hover:bg-accent/60"
                >
                  <span className="realtime-ping shrink-0">
                    <span className="status-dot status-live" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-foreground">{call.room.title}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {call.project.key} · {call.participantCount}
                      {call.isParticipant ? ' · joined' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users2 className="h-3 w-3 shrink-0" />
                    <span>{call.participantCount}</span>
                  </div>
                </Link>
              ))
            : null}
        </div>
      ) : null}

      </aside>
    </div>
  );
}

function SidebarVoiceWorkspace({
  connectionState,
  currentTarget,
  effectiveParticipantCount,
  isMicrophoneEnabled,
  isTogglingMicrophone,
  isVoiceSettingsOpen,
  runtimeError,
  selectedAudioDeviceId,
  storedAudioDeviceGroupId,
  storedAudioDeviceLabel,
  sessionUserImage,
  sessionUserName,
  onChangeAudioDevice,
  onStoreAudioDevicePreference,
  onVoiceSettingsOpenChange,
  onEndCurrentCall,
  onLeaveCurrentCall,
  onOpenVoiceSettings,
  onToggleMicrophone,
}: {
  connectionState: string;
  currentTarget: NonNullable<ReturnType<typeof useGlobalVoice>['currentTarget']>;
  effectiveParticipantCount: number;
  isMicrophoneEnabled: boolean;
  isTogglingMicrophone: boolean;
  isVoiceSettingsOpen: boolean;
  runtimeError: string | null;
  selectedAudioDeviceId: string;
  storedAudioDeviceGroupId: string | null;
  storedAudioDeviceLabel: string | null;
  sessionUserImage?: string | null;
  sessionUserName?: string | null;
  onChangeAudioDevice: (audioDeviceId: string) => Promise<void>;
  onStoreAudioDevicePreference: (input: {
    audioDeviceId: string;
    audioDeviceLabel?: string | null;
    audioDeviceGroupId?: string | null;
  }) => void;
  onVoiceSettingsOpenChange: (open: boolean) => void;
  onEndCurrentCall: () => void;
  onLeaveCurrentCall: () => void;
  onOpenVoiceSettings: () => void;
  onToggleMicrophone: () => void;
}) {
  const room = useRoomContext();
  const liveConnectionState = useConnectionState();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isChangingAudioDevice, setIsChangingAudioDevice] = useState(false);
  const [isRefreshingMicrophoneEnvironment, setIsRefreshingMicrophoneEnvironment] = useState(false);
  const [isUnlockingMicrophoneAccess, setIsUnlockingMicrophoneAccess] = useState(false);
  const [isStartingAudioPlayback, setIsStartingAudioPlayback] = useState(false);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDeviceOption[]>([]);
  const [microphonePermissionState, setMicrophonePermissionState] =
    useState<MicrophonePermissionState>('unknown');
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const allParticipants = useMemo(() => {
    if (participants.some((participant) => participant.identity === localParticipant.identity)) {
      return participants;
    }
    return [localParticipant, ...participants];
  }, [localParticipant, participants]);

  const remoteParticipants = useMemo(
    () => allParticipants.filter((participant) => participant.identity !== localParticipant.identity),
    [allParticipants, localParticipant.identity]
  );
  const participantDisplayCount = Math.max(effectiveParticipantCount, allParticipants.length || 1);
  const localMicrophoneLevel = isMicrophoneEnabled ? Math.min(1, localParticipant.audioLevel * 1.85) : 0;
  const deferredMicrophoneLevel = useDeferredValue(localMicrophoneLevel);
  const isActivelySpeaking = isMicrophoneEnabled && deferredMicrophoneLevel > 0.08;
  const resolvedConnectionState = liveConnectionState || connectionState;
  const microphoneStatusLabel = resolvedConnectionState !== 'connected'
    ? 'Connecting…'
    : isMicrophoneEnabled
      ? isActivelySpeaking
        ? 'Sending audio'
        : 'Mic live'
      : 'Muted';
  const deviceLabelsVisible = useMemo(
    () => areMicrophoneDeviceLabelsVisible(microphoneDevices),
    [microphoneDevices]
  );
  const selectedMicrophoneLabel = useMemo(() => {
    return (
      resolvePreferredAudioInputDevice(microphoneDevices, {
        audioDeviceId: selectedAudioDeviceId,
        audioDeviceGroupId: storedAudioDeviceGroupId,
        audioDeviceLabel: storedAudioDeviceLabel,
      })?.label?.trim() ||
      (selectedAudioDeviceId === 'default'
        ? 'System default microphone'
        : storedAudioDeviceLabel || 'Selected microphone unavailable')
    );
  }, [
    microphoneDevices,
    selectedAudioDeviceId,
    storedAudioDeviceGroupId,
    storedAudioDeviceLabel,
  ]);
  const microphonePermissionLabel = formatMicrophonePermissionStateLabel(microphonePermissionState);
  const microphonePermissionHelp = useMemo(
    () =>
      getMicrophonePermissionHelpMessage(microphonePermissionState, {
        userAgent,
        hasDetectedDevices: microphoneDevices.length > 0,
        labelsVisible: deviceLabelsVisible,
      }),
    [deviceLabelsVisible, microphoneDevices.length, microphonePermissionState, userAgent]
  );
  const combinedRuntimeError = settingsError || runtimeError;
  const participantsPreview = allParticipants.slice(0, 5);

  const refreshMicrophoneEnvironment = useCallback(async () => {
    try {
      setIsRefreshingMicrophoneEnvironment(true);
      const [permissionState, audioInputs] = await Promise.all([
        getMicrophonePermissionState({ silent: true }),
        listAudioInputDevices({ silent: true }),
      ]);

      setMicrophonePermissionState(permissionState);
      setMicrophoneDevices(audioInputs);

      if (selectedAudioDeviceId !== 'default') {
        const matchedSelectedDevice = resolvePreferredAudioInputDevice(audioInputs, {
          audioDeviceId: selectedAudioDeviceId,
          audioDeviceGroupId: storedAudioDeviceGroupId,
          audioDeviceLabel: storedAudioDeviceLabel,
        });

        if (matchedSelectedDevice) {
          const normalizedMatchedLabel = matchedSelectedDevice.label || '';
          const normalizedMatchedGroupId = matchedSelectedDevice.groupId || '';
          const normalizedStoredLabel = storedAudioDeviceLabel || '';
          const normalizedStoredGroupId = storedAudioDeviceGroupId || '';

          if (
            matchedSelectedDevice.deviceId !== selectedAudioDeviceId ||
            normalizedMatchedGroupId !== normalizedStoredGroupId ||
            normalizedMatchedLabel !== normalizedStoredLabel
          ) {
            onStoreAudioDevicePreference({
              audioDeviceId: matchedSelectedDevice.deviceId,
              audioDeviceGroupId: matchedSelectedDevice.groupId,
              audioDeviceLabel: matchedSelectedDevice.label,
            });
          }
        } else {
          await onChangeAudioDevice('default');
        }
      }
    } catch (error) {
      setSettingsError(
        formatMicrophoneError(error, {
          userAgent,
        })
      );
    } finally {
      setIsRefreshingMicrophoneEnvironment(false);
    }
  }, [
    onChangeAudioDevice,
    onStoreAudioDevicePreference,
    selectedAudioDeviceId,
    storedAudioDeviceGroupId,
    storedAudioDeviceLabel,
    userAgent,
  ]);

  useEffect(() => {
    void refreshMicrophoneEnvironment();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleDeviceChange = () => {
      void refreshMicrophoneEnvironment();
    };
    const handleFocus = () => {
      void refreshMicrophoneEnvironment();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshMicrophoneEnvironment();
      }
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshMicrophoneEnvironment]);

  const handleSelectMicrophone = useCallback(
    async (nextAudioDeviceId: string) => {
      try {
        setIsChangingAudioDevice(true);
        setSettingsError(null);
        const selectedDevice = microphoneDevices.find(
          (device) => device.deviceId === nextAudioDeviceId
        );
        if (selectedDevice) {
          onStoreAudioDevicePreference({
            audioDeviceId: selectedDevice.deviceId,
            audioDeviceGroupId: selectedDevice.groupId,
            audioDeviceLabel: selectedDevice.label,
          });
        }
        await onChangeAudioDevice(nextAudioDeviceId);
        await refreshMicrophoneEnvironment();
      } catch (error) {
        setSettingsError(formatMicrophoneError(error));
      } finally {
        setIsChangingAudioDevice(false);
      }
    },
    [microphoneDevices, onChangeAudioDevice, onStoreAudioDevicePreference, refreshMicrophoneEnvironment]
  );

  const handleRequestMicrophoneAccess = useCallback(async () => {
    if (isUnlockingMicrophoneAccess) {
      return;
    }

    try {
      setIsUnlockingMicrophoneAccess(true);
      setSettingsError(null);
      await requestMicrophonePermission();
      await refreshMicrophoneEnvironment();
    } catch (error) {
      setSettingsError(formatMicrophoneError(error));
    } finally {
      setIsUnlockingMicrophoneAccess(false);
    }
  }, [isUnlockingMicrophoneAccess, refreshMicrophoneEnvironment]);

  const handleEnableAudioPlayback = useCallback(async () => {
    try {
      setIsStartingAudioPlayback(true);
      setSettingsError(null);
      await startAudio();
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : 'Browser audio playback could not be enabled.'
      );
    } finally {
      setIsStartingAudioPlayback(false);
    }
  }, [startAudio]);

  return (
    <>
      <div className="space-y-2 rounded-sm bg-surface p-2">
        <div className="flex items-start gap-2">
          <span className="realtime-ping mt-1 shrink-0">
            <span
              className={cn(
                'status-dot',
                resolvedConnectionState === 'connected' ? 'status-live' : 'status-warn'
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-foreground">
              {currentTarget.roomTitle}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {currentTarget.projectName} · {participantDisplayCount} in call
            </div>
          </div>
          <div className="flex items-center gap-1">
            {resolvedConnectionState === 'connected' ? (
              <span className="live-pill text-[9px]">live</span>
            ) : (
              <span className="chip text-[9px]">offline</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 rounded-sm px-0 text-muted-foreground transition-all duration-150 ease-snap"
              onClick={onOpenVoiceSettings}
              title="Open voice settings"
              aria-label="Open voice settings"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-2">
          <div className="flex min-w-0 flex-1 items-center">
            {participantsPreview.length > 0 ? (
              <div className="flex min-w-0 items-center">
                {participantsPreview.map((participant, index) => (
                  <SidebarVoiceParticipantAvatar
                    key={participant.identity}
                    className={cn(index > 0 && '-ml-2')}
                    isCurrentUser={participant.identity === localParticipant.identity}
                    participant={participant}
                    sessionUserImage={sessionUserImage}
                    sessionUserName={sessionUserName}
                  />
                ))}
                {participantDisplayCount > participantsPreview.length ? (
                  <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                    +{participantDisplayCount - participantsPreview.length}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">Waiting for participant info…</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Voice
            </div>
            <div className="pt-0.5 text-[11px] font-medium text-foreground">{microphoneStatusLabel}</div>
          </div>
        </div>

        <div className="space-y-1 rounded-sm bg-surface-2 px-2 py-2">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Mic level
            </span>
            <span className="text-muted-foreground">{Math.round(deferredMicrophoneLevel * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/30">
            <div
              className={cn(
                'h-full transition-[width] duration-150',
                isActivelySpeaking ? 'bg-accent-emerald' : 'bg-foreground/80'
              )}
              style={{ width: `${Math.round(deferredMicrophoneLevel * 100)}%` }}
            />
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{selectedMicrophoneLabel}</div>
        </div>

        <div className="flex items-center gap-1">
          <Link href={currentTarget.roomHref} className="min-w-0 flex-1">
            <Button size="sm" variant="outline" className="h-6 w-full rounded-sm px-2 text-[11px]">
              <PhoneCall className="mr-1 h-3 w-3" />
              Room
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 rounded-sm px-0"
            onClick={onToggleMicrophone}
            disabled={resolvedConnectionState !== 'connected' || isTogglingMicrophone}
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
            onClick={onLeaveCurrentCall}
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
            onClick={onEndCurrentCall}
          >
            End room for everyone
          </Button>
        ) : null}

        {combinedRuntimeError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            {combinedRuntimeError}
          </div>
        ) : null}
      </div>

      <Dialog open={isVoiceSettingsOpen} onOpenChange={onVoiceSettingsOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Meeting settings</DialogTitle>
            <DialogDescription>
              Manage your microphone, watch live audio activity, and keep an eye on who is speaking from anywhere in the app.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-md bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'status-dot',
                        resolvedConnectionState === 'connected'
                          ? isActivelySpeaking
                            ? 'status-live'
                            : 'status-warn'
                          : 'status-warn'
                      )}
                    />
                    <div className="text-sm font-semibold text-foreground">{currentTarget.roomTitle}</div>
                    <span className="rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {formatConnectionStateLabel(resolvedConnectionState)}
                    </span>
                  </div>
                  <div className="pt-1 text-xs text-muted-foreground">
                    {currentTarget.projectName} · {participantDisplayCount} in call · {microphoneStatusLabel}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!canPlayAudio && remoteParticipants.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm"
                      onClick={() => void handleEnableAudioPlayback()}
                      disabled={isStartingAudioPlayback}
                    >
                      {isStartingAudioPlayback ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Volume2 className="mr-2 h-4 w-4" />
                      )}
                      Enable audio
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={isMicrophoneEnabled ? 'default' : 'outline'}
                    className="rounded-sm"
                    onClick={onToggleMicrophone}
                    disabled={resolvedConnectionState !== 'connected' || isTogglingMicrophone}
                  >
                    {isTogglingMicrophone ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isMicrophoneEnabled ? (
                      <MicOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Mic className="mr-2 h-4 w-4" />
                    )}
                    {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={onLeaveCurrentCall}>
                    <PhoneOff className="mr-2 h-4 w-4" />
                    Leave
                  </Button>
                  {currentTarget.canManageCalls ? (
                    <Button size="sm" variant="outline" className="rounded-sm" onClick={onEndCurrentCall}>
                      End room
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {participantsPreview.map((participant) => (
                  <SidebarVoiceParticipantAvatar
                    key={participant.identity}
                    isCurrentUser={participant.identity === localParticipant.identity}
                    participant={participant}
                    sessionUserImage={sessionUserImage}
                    sessionUserName={sessionUserName}
                  />
                ))}
              </div>
            </div>

            {combinedRuntimeError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {combinedRuntimeError}
              </div>
            ) : null}

            <div className="rounded-md border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Microphone</div>
                  <div className="pt-1 text-xs text-muted-foreground">
                    Choose the input device you want TaskNebula to use for this call.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Level
                  </div>
                  <div className="pt-1 text-sm font-semibold tabular-nums text-foreground">
                    {Math.round(deferredMicrophoneLevel * 100)}%
                  </div>
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/25">
                <div
                  className={cn(
                    'h-full transition-[width] duration-150',
                    isActivelySpeaking ? 'bg-accent-emerald' : 'bg-foreground/80'
                  )}
                  style={{ width: `${Math.round(deferredMicrophoneLevel * 100)}%` }}
                />
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Input device
                </label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
                  value={selectedAudioDeviceId}
                  onChange={(event) => {
                    void handleSelectMicrophone(event.target.value);
                  }}
                  disabled={isChangingAudioDevice || isRefreshingMicrophoneEnvironment}
                >
                  <option value="default">System default microphone</option>
                  {microphoneDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {formatMicrophoneDeviceOptionLabel(device, index)}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">
                  Current selection: <span className="font-medium text-foreground">{selectedMicrophoneLabel}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Permission:</span> {microphonePermissionLabel}
                </div>
                <div className="flex flex-wrap gap-2">
                  {microphonePermissionState !== 'granted' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-sm px-2 text-xs"
                      onClick={() => void handleRequestMicrophoneAccess()}
                      disabled={isUnlockingMicrophoneAccess}
                    >
                      {isUnlockingMicrophoneAccess ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mic className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Unlock microphone
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-sm px-2 text-xs"
                    onClick={() => void refreshMicrophoneEnvironment()}
                    disabled={isRefreshingMicrophoneEnvironment}
                  >
                    {isRefreshingMicrophoneEnvironment ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Refresh devices
                  </Button>
                </div>
              </div>

              <div className="mt-3 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
                {microphonePermissionHelp}
                {microphoneDevices.length === 0 ? ' No microphones are currently visible to the browser.' : ''}
                {microphonePermissionState === 'granted' && !deviceLabelsVisible
                  ? ' The browser still has not exposed microphone labels; refreshing after returning from browser settings usually fixes that.'
                  : ''}
                {selectedAudioDeviceId !== 'default' && microphonePermissionState !== 'granted'
                  ? ' Exact device switching becomes much more reliable once microphone access is fully granted.'
                  : ''}
              </div>
            </div>

            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">People in the call</div>
                  <div className="pt-1 text-xs text-muted-foreground">
                    Speaking participants glow green. Quiet participants stay neutral.
                  </div>
                </div>
                <div className="rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {participantDisplayCount} total
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {allParticipants.map((participant) => (
                  <SidebarVoiceParticipantRow
                    key={participant.identity}
                    isCurrentUser={participant.identity === localParticipant.identity}
                    participant={participant}
                    sessionUserImage={sessionUserImage}
                    sessionUserName={sessionUserName}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarVoiceFallbackCard({
  connectionState,
  currentTarget,
  effectiveParticipantCount,
  isMicrophoneEnabled,
  isTogglingMicrophone,
  runtimeError,
  onEndCurrentCall,
  onLeaveCurrentCall,
  onOpenVoiceSettings,
  onToggleMicrophone,
}: {
  connectionState: string;
  currentTarget: NonNullable<ReturnType<typeof useGlobalVoice>['currentTarget']>;
  effectiveParticipantCount: number;
  isMicrophoneEnabled: boolean;
  isTogglingMicrophone: boolean;
  runtimeError: string | null;
  onEndCurrentCall: () => void;
  onLeaveCurrentCall: () => void;
  onOpenVoiceSettings: () => void;
  onToggleMicrophone: () => void;
}) {
  const isConnecting = connectionState !== 'connected';
  const voiceStatusLabel = isConnecting ? 'Connecting…' : isMicrophoneEnabled ? 'Mic live' : 'Muted';

  return (
    <div className="space-y-2 rounded-sm bg-surface p-2">
      <div className="flex items-start gap-2">
        <span className="realtime-ping mt-1 shrink-0">
          <span className={cn('status-dot', isConnecting ? 'status-warn' : 'status-live')} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-foreground">{currentTarget.roomTitle}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {currentTarget.projectName} · {effectiveParticipantCount} in call
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 rounded-sm px-0 text-muted-foreground"
          onClick={onOpenVoiceSettings}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="rounded-sm bg-surface-2 px-2 py-2 text-[10px] text-muted-foreground">
        Voice status: {voiceStatusLabel}
      </div>

      <div className="flex items-center gap-1">
        <Link href={currentTarget.roomHref} className="min-w-0 flex-1">
          <Button size="sm" variant="outline" className="h-6 w-full rounded-sm px-2 text-[11px]">
            <PhoneCall className="mr-1 h-3 w-3" />
            Room
          </Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 rounded-sm px-0"
          onClick={onToggleMicrophone}
          disabled={isConnecting || isTogglingMicrophone}
        >
          {isTogglingMicrophone ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isMicrophoneEnabled ? (
            <MicOff className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
        </Button>
        <Button size="sm" variant="outline" className="h-6 w-6 rounded-sm px-0" onClick={onLeaveCurrentCall}>
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>

      {currentTarget.canManageCalls ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-full rounded-sm px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onEndCurrentCall}
        >
          End room for everyone
        </Button>
      ) : null}

      {runtimeError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
          {runtimeError}
        </div>
      ) : null}
    </div>
  );
}

function SidebarVoiceParticipantAvatar({
  className,
  isCurrentUser,
  participant,
  sessionUserImage,
  sessionUserName,
}: {
  className?: string;
  isCurrentUser: boolean;
  participant: Participant;
  sessionUserImage?: string | null;
  sessionUserName?: string | null;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMicrophoneActive = participant.isMicrophoneEnabled;
  const displayName =
    participant.name || (isCurrentUser ? sessionUserName : null) || participant.identity || 'Participant';

  return (
    <Avatar
      className={cn(
        'h-7 w-7 border border-background transition-[box-shadow,transform,background-color] duration-150',
        isSpeaking && isMicrophoneActive
          ? 'ring-2 ring-accent-emerald/60 shadow-glow'
          : 'shadow-none',
        className
      )}
    >
      {isCurrentUser && sessionUserImage ? (
        <AvatarImage src={sessionUserImage} alt={displayName ?? 'Participant'} />
      ) : null}
      <AvatarFallback
        className={cn(
          'text-[10px] font-semibold',
          isSpeaking && isMicrophoneActive
            ? 'bg-accent-emerald/15 text-accent-emerald'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

function SidebarVoiceParticipantRow({
  isCurrentUser,
  participant,
  sessionUserImage,
  sessionUserName,
}: {
  isCurrentUser: boolean;
  participant: Participant;
  sessionUserImage?: string | null;
  sessionUserName?: string | null;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const displayName =
    participant.name || (isCurrentUser ? sessionUserName : null) || participant.identity || 'Participant';
  const isMicrophoneActive = participant.isMicrophoneEnabled;
  const stateLabel = isMicrophoneActive
    ? isSpeaking
      ? isCurrentUser
        ? 'Sending audio'
        : 'Speaking'
      : isCurrentUser
        ? 'Mic on'
        : 'Listening'
    : 'Muted';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150',
        isSpeaking && isMicrophoneActive
          ? 'border border-accent-emerald/30 bg-accent-emerald/10'
          : 'bg-surface'
      )}
    >
      <SidebarVoiceParticipantAvatar
        isCurrentUser={isCurrentUser}
        participant={participant}
        sessionUserImage={sessionUserImage}
        sessionUserName={sessionUserName}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
          {isCurrentUser ? (
            <span className="rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              You
            </span>
          ) : null}
        </div>
        <div className="pt-0.5 text-xs text-muted-foreground">{stateLabel}</div>
      </div>

      {isMicrophoneActive ? (
        <Mic className={cn('h-3.5 w-3.5', isSpeaking ? 'text-accent-emerald' : 'text-muted-foreground')} />
      ) : (
        <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

function formatConnectionStateLabel(state: string) {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Voice room';
  }
}

function formatMicrophoneDeviceOptionLabel(
  device: Pick<MicrophoneDeviceOption, 'deviceId' | 'label'>,
  index: number
) {
  const label = device.label.trim();
  if (label) {
    return label;
  }

  return `Microphone ${index + 1}`;
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'TN'
  );
}
