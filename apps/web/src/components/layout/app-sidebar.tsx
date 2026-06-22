'use client';

import type { Participant } from 'livekit-client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  Bell,
  Building2,
  Clock,
  Eye,
  FileText,
  KeyRound,
  Palette,
  Pin,
  Plug,
  Sparkles,
  Tags,
  UserCog,
  UserPlus,
  Webhook,
  Zap,
  Bot,
  Flag,
  Gauge,
  MessageSquareText,
  Scroll,
  ScrollText,
} from 'lucide-react';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamspaceSwitcher } from '@/components/organization/teamspace-switcher';
import { AppRail } from '@/components/layout/app-rail';
import { stripLocalePrefix } from '@/components/layout/nav-paths';
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
import { useOrganizationPermissions, type Permission } from '@/lib/hooks/use-permissions';
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

// NOTE: high-traffic nav strings now come from next-intl. The `label`
// fields below are kept as English fallback labels so this file still
// compiles in isolation, but `i18nKey` is the source of truth at render
// time (see `useTranslations('nav')` inside AppSidebar).
const MY_ISSUES_VIEWS: Array<{
  value: string;
  label: string;
  i18nKey: string;
  icon: typeof Inbox;
}> = [
  { value: 'assigned', label: 'Assigned to me', i18nKey: 'assigned_to_me', icon: Inbox },
  { value: 'created', label: 'Created by me', i18nKey: 'created_by_me', icon: UserPlus },
  { value: 'subscribed', label: 'Subscribed', i18nKey: 'subscribed', icon: Eye },
  { value: 'mentioned', label: 'Mentioned', i18nKey: 'mentioned', icon: Sparkles },
];

const INBOX_LINKS: Array<{
  href: string;
  label: string;
  pageHomeKey: string;
  icon: typeof Inbox;
  match?: { actor?: string; unread?: boolean; snoozed?: boolean };
}> = [
  { href: '/inbox', label: 'All', pageHomeKey: 'inbox_actor_all', icon: Inbox },
  {
    href: '/inbox?unread=1',
    label: 'Unread only',
    pageHomeKey: 'inbox_unread_only',
    icon: Bell,
    match: { unread: true },
  },
  {
    href: '/inbox?actor=user',
    label: 'People',
    pageHomeKey: 'inbox_actor_people',
    icon: Users,
    match: { actor: 'user' },
  },
  {
    href: '/inbox?actor=agent',
    label: 'Agents',
    pageHomeKey: 'inbox_actor_agents',
    icon: Bot,
    match: { actor: 'agent' },
  },
  {
    href: '/inbox?actor=webhook',
    label: 'Webhooks',
    pageHomeKey: 'inbox_actor_webhooks',
    icon: Webhook,
    match: { actor: 'webhook' },
  },
  {
    href: '/inbox?actor=system',
    label: 'System',
    pageHomeKey: 'inbox_actor_system',
    icon: Zap,
    match: { actor: 'system' },
  },
  {
    href: '/inbox?snoozed=1',
    label: 'Snoozed',
    pageHomeKey: 'inbox_snoozed',
    icon: Clock,
    match: { snoozed: true },
  },
];

const DASHBOARD_LINKS: Array<{ href: string; label: string; i18nKey: string; icon: typeof Home }> =
  [
    { href: '/dashboard', label: 'Overview', i18nKey: 'overview', icon: Home },
    { href: '/drafts', label: 'Drafts', i18nKey: 'drafts', icon: FileText },
    { href: '/templates', label: 'Templates', i18nKey: 'templates', icon: Pin },
  ];

const TEAM_LINKS: NavLink[] = [
  {
    href: '/team',
    label: 'Members',
    i18nKey: 'members',
    icon: Users,
    match: { path: '/team', tab: 'members' },
    requiredPermission: 'member:view',
  },
  {
    href: '/team?tab=teamspaces',
    label: 'Teamspaces',
    i18nKey: 'teamspaces',
    icon: Building2,
    match: { path: '/team', tab: 'teamspaces' },
    requiredPermission: 'team:view',
  },
  {
    href: '/team?tab=invites',
    label: 'Pending invites',
    i18nKey: 'pending_invites',
    icon: UserPlus,
    match: { path: '/team', tab: 'invites' },
    requiredPermission: 'member:view',
  },
];

const SETTINGS_LINKS: NavLink[] = [
  {
    href: '/settings?tab=organization',
    label: 'Organization',
    i18nKey: 'organization',
    icon: Building2,
    match: { path: '/settings', tab: 'organization' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings?tab=members',
    label: 'Members',
    i18nKey: 'members',
    icon: Users,
    match: { path: '/settings', tab: 'members' },
    requiredPermission: 'member:view',
  },
  {
    href: '/settings?tab=api-keys',
    label: 'API Keys',
    i18nKey: 'api_keys',
    icon: KeyRound,
    match: { path: '/settings', tab: 'api-keys' },
    requiredPermission: 'api_key:view',
  },
  {
    href: '/settings?tab=webhooks',
    label: 'Webhooks',
    i18nKey: 'webhooks',
    icon: Webhook,
    match: { path: '/settings', tab: 'webhooks' },
    requiredPermission: 'webhook:view',
  },
  {
    // Every active member may manage labels (the /api/labels routes only
    // require org membership), so no requiredPermission gate here.
    href: '/settings?tab=labels',
    label: 'Labels',
    i18nKey: 'labels',
    icon: Tags,
    match: { path: '/settings', tab: 'labels' },
  },
  {
    href: '/settings/integrations',
    label: 'Integrations',
    i18nKey: 'integrations',
    icon: Plug,
    match: { path: '/settings/integrations' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings/security/audit-log-streaming',
    label: 'Audit streaming',
    i18nKey: 'audit_streaming',
    icon: Radio,
    match: { path: '/settings/security/audit-log-streaming' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings?tab=ai-agents',
    label: 'AI & Agents',
    i18nKey: 'ai_agents',
    icon: Bot,
    match: { path: '/settings', tab: 'ai-agents' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings?tab=ai-transparency',
    label: 'AI Transparency',
    i18nKey: 'ai_transparency',
    icon: Sparkles,
    match: { path: '/settings', tab: 'ai-transparency' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings?tab=communications',
    label: 'Communications',
    i18nKey: 'communications',
    icon: MessageSquareText,
    match: { path: '/settings', tab: 'communications' },
    requiredPermission: 'org:settings',
  },
  {
    href: '/settings?tab=notifications',
    label: 'Notifications',
    i18nKey: 'notifications',
    icon: Bell,
    match: { path: '/settings', tab: 'notifications' },
  },
  {
    href: '/settings?tab=appearance',
    label: 'Appearance',
    i18nKey: 'appearance',
    icon: Palette,
    match: { path: '/settings', tab: 'appearance' },
  },
  {
    href: '/settings?tab=audit-log',
    label: 'Activity',
    i18nKey: 'activity',
    icon: ScrollText,
    match: { path: '/settings', tab: 'audit-log' },
    requiredPermission: 'org:manage',
  },
];

const PERSONAL_SETTINGS_KEYS = new Set(['appearance']);

const ADMIN_LINKS: Array<{
  href: string;
  label: string;
  i18nKey: string;
  icon: typeof Gauge;
  match: { path: string; tab?: string };
}> = [
  {
    href: '/admin?tab=overview',
    label: 'Overview',
    i18nKey: 'overview',
    icon: Gauge,
    match: { path: '/admin', tab: 'overview' },
  },
  {
    href: '/admin?tab=organizations',
    label: 'Organizations',
    i18nKey: 'organizations',
    icon: Building2,
    match: { path: '/admin', tab: 'organizations' },
  },
  {
    href: '/admin?tab=users',
    label: 'Users',
    i18nKey: 'users',
    icon: UserCog,
    match: { path: '/admin', tab: 'users' },
  },
  {
    href: '/admin?tab=feature-flags',
    label: 'Feature flags',
    i18nKey: 'feature_flags',
    icon: Flag,
    match: { path: '/admin', tab: 'feature-flags' },
  },
  {
    href: '/admin?tab=agents',
    label: 'Agent control',
    i18nKey: 'agent_control',
    icon: Bot,
    match: { path: '/admin', tab: 'agents' },
  },
  {
    href: '/admin?tab=system',
    label: 'System',
    i18nKey: 'system',
    icon: Shield,
    match: { path: '/admin', tab: 'system' },
  },
  {
    href: '/admin?tab=updates',
    label: 'Updates',
    i18nKey: 'updates',
    icon: RefreshCw,
    match: { path: '/admin', tab: 'updates' },
  },
  {
    href: '/admin?tab=realtime',
    label: 'Realtime health',
    i18nKey: 'realtime_health',
    icon: Radio,
    match: { path: '/admin', tab: 'realtime' },
  },
  {
    href: '/admin?tab=audit',
    label: 'Audit logs',
    i18nKey: 'audit_logs',
    icon: Scroll,
    match: { path: '/admin', tab: 'audit' },
  },
];

type NavLink = {
  href: string;
  label: string;
  /** Key under the `nav` namespace in messages/{locale}.json. Optional so
   *  partially-migrated lists still type-check. */
  i18nKey?: string;
  icon: typeof Settings;
  match?: { path: string; tab?: string };
  requiredPermission?: Permission;
};

const DEFAULT_TAB_BY_PATH: Record<string, string> = {
  '/settings': 'organization',
  '/admin': 'overview',
  '/team': 'members',
};

function isNavLinkActive(
  link: NavLink,
  pathname: string | null | undefined,
  activeTab: string | null | undefined
): boolean {
  const path = stripLocalePrefix(pathname);
  if (!link.match) return path === link.href;
  if (path !== link.match.path) return false;
  if (!link.match.tab) return !activeTab;
  const defaultTab = DEFAULT_TAB_BY_PATH[link.match.path];
  if (link.match.tab === defaultTab) {
    return !activeTab || activeTab === defaultTab;
  }
  return activeTab === link.match.tab;
}

function getSectionKey(pathname: string | null | undefined): string {
  const path = stripLocalePrefix(pathname);
  if (
    path === '/' ||
    path.startsWith('/dashboard') ||
    path.startsWith('/drafts') ||
    path.startsWith('/templates')
  )
    return 'dashboard';
  if (path.startsWith('/my-issues') || path.startsWith('/issues')) return 'my_issues';
  if (path.startsWith('/inbox')) return 'inbox';
  if (path.startsWith('/initiatives')) return 'projects';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/docs')) return 'docs';
  if (path.startsWith('/team')) return 'team';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function isInboxLinkActive(
  link: (typeof INBOX_LINKS)[number],
  searchParams: ReturnType<typeof useSearchParams>
): boolean {
  const actor = searchParams?.get('actor') ?? null;
  const unread = searchParams?.get('unread') === '1';
  const snoozed = searchParams?.get('snoozed') === '1';
  const type = searchParams?.get('type') ?? null;

  if (!link.match) return actor === null && !unread && !snoozed && !type;
  if (type) return false;
  if (link.match.actor) return actor === link.match.actor && !unread && !snoozed;
  if (link.match.unread) return unread && actor === null && !snoozed;
  if (link.match.snoozed) return snoozed && actor === null && !unread;
  return false;
}

function isHomeSectionPath(pathname: string | null | undefined): boolean {
  const path = stripLocalePrefix(pathname);
  return (
    path === '/' ||
    path === '/dashboard' ||
    path.startsWith('/drafts') ||
    path.startsWith('/templates')
  );
}

const SIDEBAR_NAV_LINK_CLASS =
  'row-interactive text-muted-foreground ease-snap border border-transparent hover:text-foreground data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:text-primary min-h-8 w-full min-w-0 rounded-md text-[13px] font-medium transition-all duration-150';
const SIDEBAR_NAV_LABEL_CLASS = 'min-w-0 flex-1 truncate';

export function AppSidebar({
  hasWorkspaceAccess = true,
  isSuperAdmin: initialIsSuperAdmin = false,
}: {
  hasWorkspaceAccess?: boolean;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPathname = stripLocalePrefix(pathname);
  const isSettingsRoute = normalizedPathname.startsWith('/settings');
  const isAdminRoute = normalizedPathname.startsWith('/admin');
  const tNav = useTranslations('nav');
  const tHome = useTranslations('pagesHome');
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const tLayout = useTranslations('layoutNav');
  const { data: session } = useSession();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const { data: liveCalls, isLoading: liveCallsLoading } = useLiveCalls({
    enabled: hasWorkspaceAccess,
  });
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
    organizationId: hasWorkspaceAccess ? currentOrganizationId : null,
    teamId: hasWorkspaceAccess ? currentTeamId : null,
    enabled: hasWorkspaceAccess,
  });

  const isSuperAdmin = userData?.isSuperAdmin ?? initialIsSuperAdmin;

  const { has: hasOrgPermission, isLoading: isLoadingOrgPermissions } = useOrganizationPermissions(
    currentOrganizationId ?? undefined
  );

  const visibleSettingsLinks = useMemo(() => {
    if (!hasWorkspaceAccess) {
      return SETTINGS_LINKS.filter(
        (link) => link.i18nKey && PERSONAL_SETTINGS_KEYS.has(link.i18nKey)
      );
    }
    if (isLoadingOrgPermissions) {
      return SETTINGS_LINKS.filter((link) => !link.requiredPermission);
    }
    return SETTINGS_LINKS.filter(
      (link) => !link.requiredPermission || hasOrgPermission(link.requiredPermission)
    );
  }, [hasOrgPermission, hasWorkspaceAccess, isLoadingOrgPermissions]);

  const visibleTeamLinks = useMemo(() => {
    if (!hasWorkspaceAccess) return [];
    if (isLoadingOrgPermissions) return [];
    return TEAM_LINKS.filter(
      (link) => !link.requiredPermission || hasOrgPermission(link.requiredPermission)
    );
  }, [hasOrgPermission, hasWorkspaceAccess, isLoadingOrgPermissions]);
  const canViewTeamspaces =
    hasWorkspaceAccess && !isLoadingOrgPermissions && hasOrgPermission('team:view');
  const visibleDashboardLinks = useMemo(() => {
    if (hasWorkspaceAccess) {
      return DASHBOARD_LINKS;
    }
    return DASHBOARD_LINKS.filter((link) => link.href === '/dashboard');
  }, [hasWorkspaceAccess]);
  const pinnedCall = currentTarget
    ? liveCalls?.find(
        (call) => call.roomId === currentTarget.roomId && call.participantCount > 0
      ) || null
    : null;
  const otherActiveCalls = (liveCalls || [])
    .filter((call) => call.roomId !== currentTarget?.roomId && call.participantCount > 0)
    .slice(0, 3);
  const effectiveParticipantCount = Math.max(
    pinnedCall?.participantCount ?? 0,
    currentSession && connectionState === 'connected' ? Math.max(participantCount, 1) : 0
  );
  const selectedRoomId = searchParams.get('roomId');
  const currentCallRoomPath = currentTarget?.roomHref.split('?')[0] || null;
  const isViewingCurrentCallRoom = Boolean(
    currentTarget &&
      currentCallRoomPath &&
      normalizedPathname === stripLocalePrefix(currentCallRoomPath) &&
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
      <AppRail hasWorkspaceAccess={hasWorkspaceAccess} isSuperAdmin={isSuperAdmin} />
      <aside className="border-border bg-surface flex w-64 flex-col border-r">
        <div className="border-border flex h-12 items-center border-b px-3">
          <button
            className="ease-snap hover:bg-accent/60 flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium transition-all duration-150"
            aria-label={tActions('switch_workspace')}
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                <TaskNebulaLogo compact className="h-5 w-5" />
              </div>
              <span className="text-foreground font-semibold tracking-tight">TaskNebula</span>
            </div>
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          </button>
        </div>

        <nav
          aria-label={tLayout('section')}
          className={cn(
            'min-h-0 flex-1',
            hasPageSidebar
              ? 'flex flex-col overflow-hidden'
              : 'custom-scrollbar overflow-y-auto pb-3'
          )}
        >
          <PageSidebarSlotTarget
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              !hasPageSidebar && 'hidden'
            )}
          />

          <div className={cn('px-2.5 py-3', hasPageSidebar && 'hidden')}>
            {isSettingsRoute || isAdminRoute ? null : (
              <div className="mb-2 px-3">
                <div className="kicker">{tNav(getSectionKey(pathname))}</div>
              </div>
            )}

            {hasWorkspaceAccess &&
            (normalizedPathname.startsWith('/my-issues') ||
              normalizedPathname.startsWith('/issues')) ? (
              <div className="space-y-0.5">
                {MY_ISSUES_VIEWS.map((view) => {
                  const isActive =
                    normalizedPathname.startsWith('/my-issues') &&
                    (searchParams?.get('view') ?? 'assigned') === view.value;
                  return (
                    <Link
                      key={view.value}
                      href={`/my-issues?view=${view.value}`}
                      data-active={isActive ? 'true' : undefined}
                      className={SIDEBAR_NAV_LINK_CLASS}
                    >
                      <view.icon className="h-4 w-4 shrink-0" />
                      <span className={SIDEBAR_NAV_LABEL_CLASS}>
                        {view.i18nKey ? tNav(view.i18nKey) : view.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {hasWorkspaceAccess && normalizedPathname.startsWith('/inbox') ? (
              <div className="space-y-0.5">
                {INBOX_LINKS.map((link) => {
                  const isActive = isInboxLinkActive(link, searchParams);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-active={isActive ? 'true' : undefined}
                      className={SIDEBAR_NAV_LINK_CLASS}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      <span className={SIDEBAR_NAV_LABEL_CLASS}>{tHome(link.pageHomeKey)}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {isHomeSectionPath(pathname) ? (
              <div className="space-y-0.5">
                {visibleDashboardLinks.map((link) => {
                  const isActive =
                    link.href === normalizedPathname ||
                    (link.href === '/dashboard' && normalizedPathname === '/');
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-active={isActive ? 'true' : undefined}
                      className={SIDEBAR_NAV_LINK_CLASS}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      <span className={SIDEBAR_NAV_LABEL_CLASS}>
                        {link.i18nKey ? tNav(link.i18nKey) : link.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {hasWorkspaceAccess && normalizedPathname.startsWith('/team') ? (
              <div className="space-y-0.5">
                {visibleTeamLinks.map((link) => {
                  const isActive = isNavLinkActive(link, pathname, searchParams?.get('tab'));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-active={isActive ? 'true' : undefined}
                      className={SIDEBAR_NAV_LINK_CLASS}
                    >
                      <link.icon className="h-4 w-4 shrink-0" />
                      <span className={SIDEBAR_NAV_LABEL_CLASS}>
                        {link.i18nKey ? tNav(link.i18nKey) : link.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {isSettingsRoute || isAdminRoute ? (
              <>
                {isSettingsRoute && visibleSettingsLinks.length > 0 ? (
                  <>
                    <div className="mb-1 flex items-center gap-2 px-3 pt-1">
                      <Settings className="text-muted-foreground h-3 w-3" />
                      <span className="kicker">{tNav('settings')}</span>
                    </div>
                    <div className="space-y-0.5">
                      {visibleSettingsLinks.map((link) => {
                        const isActive = isNavLinkActive(link, pathname, searchParams?.get('tab'));
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            data-active={isActive ? 'true' : undefined}
                            className={SIDEBAR_NAV_LINK_CLASS}
                          >
                            <link.icon className="h-4 w-4 shrink-0" />
                            <span className={SIDEBAR_NAV_LABEL_CLASS}>
                              {link.i18nKey ? tNav(link.i18nKey) : link.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {isAdminRoute && isSuperAdmin ? (
                  <>
                    <div className="mb-1 flex items-center gap-2 px-3 pt-1">
                      <Shield className="text-muted-foreground h-3 w-3" />
                      <span className="kicker">{tNav('admin')}</span>
                    </div>
                    <div className="space-y-0.5">
                      {ADMIN_LINKS.map((link) => {
                        const isActive = isNavLinkActive(link, pathname, searchParams?.get('tab'));
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            data-active={isActive ? 'true' : undefined}
                            className={SIDEBAR_NAV_LINK_CLASS}
                          >
                            <link.icon className="h-4 w-4 shrink-0" />
                            <span className={SIDEBAR_NAV_LABEL_CLASS}>{tNav(link.i18nKey)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {hasWorkspaceAccess &&
            (normalizedPathname.startsWith('/projects') || isHomeSectionPath(pathname)) ? (
              <div>
                {canViewTeamspaces ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTeamspacesOpen((open) => !open)}
                      aria-expanded={isTeamspacesOpen}
                      className="hover:text-foreground mb-1 mt-4 flex w-full items-center gap-1 px-3 text-start transition-colors duration-150"
                    >
                      {isTeamspacesOpen ? (
                        <ChevronDown className="text-muted-foreground h-3 w-3" />
                      ) : (
                        <ChevronRight className="text-muted-foreground h-3 w-3" />
                      )}
                      <span className="kicker">{tNav('teamspaces')}</span>
                    </button>
                    {isTeamspacesOpen ? (
                      <div className="px-1 pb-2">
                        <TeamspaceSwitcher />
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="mb-1 mt-4 flex items-center justify-between px-3">
                  <button
                    type="button"
                    onClick={() => setIsProjectsOpen((open) => !open)}
                    aria-expanded={isProjectsOpen}
                    className="hover:text-foreground flex flex-1 items-center gap-1 text-start transition-colors duration-150"
                  >
                    {isProjectsOpen ? (
                      <ChevronDown className="text-muted-foreground h-3 w-3" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-3 w-3" />
                    )}
                    <span className="kicker">{tNav('projects')}</span>
                  </button>
                  <Link href="/projects">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-6 w-6 rounded-sm"
                      aria-label={tNav('projects')}
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
                          <span className="sr-only">{tCommon('loading')}</span>
                          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        </span>
                      </div>
                    ) : projects && projects.length > 0 ? (
                      projects.slice(0, 5).map((project) => {
                        const projectPath = project.key?.toLowerCase() || project.id;
                        const isActive = normalizedPathname.includes(`/projects/${projectPath}`);
                        const projectIcon = (project as { icon?: string | null }).icon;
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${projectPath}/views`}
                            data-active={isActive ? 'true' : undefined}
                            className={cn(SIDEBAR_NAV_LINK_CLASS, 'group')}
                          >
                            <div className="bg-card border-border flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border">
                              {projectIcon ? (
                                <span className="text-xs leading-none" aria-hidden="true">
                                  {projectIcon}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[9px] font-bold">
                                  {project.name.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="flex-1 truncate">{project.name}</span>
                            <span className="text-muted-foreground font-mono text-[10px] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                              {project.key}
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-center">
                        <p className="text-muted-foreground text-xs">{tCommon('no_projects')}</p>
                      </div>
                    )}
                    {projects && projects.length > 5 ? (
                      <Link
                        href="/projects"
                        className="row-interactive text-muted-foreground ease-snap hover:text-foreground rounded-md text-xs transition-all duration-150"
                      >
                        {tCommon('view_all_projects', { count: projects.length })}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </nav>

        {currentTarget || otherActiveCalls.length > 0 || sidebarRuntimeError ? (
          <div className="border-border bg-card/70 space-y-1.5 border-t px-3 py-3">
            <button
              type="button"
              onClick={() => setIsLiveCallsOpen((open) => !open)}
              aria-expanded={isLiveCallsOpen}
              className="hover:text-foreground flex w-full items-center gap-1 text-start transition-colors duration-150"
            >
              {isLiveCallsOpen ? (
                <ChevronDown className="text-muted-foreground h-3 w-3" />
              ) : (
                <ChevronRight className="text-muted-foreground h-3 w-3" />
              )}
              <span className="kicker px-0">{tNav('live_calls')}</span>
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
              <div className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {tLayout('checkingActiveCalls')}
              </div>
            ) : null}

            {isLiveCallsOpen
              ? otherActiveCalls.map((call) => (
                  <Link
                    key={call.id}
                    href={call.room.href}
                    className="bg-surface-2 ease-snap hover:bg-accent/60 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-start transition-all duration-150"
                  >
                    <span className="realtime-ping shrink-0">
                      <span className="status-dot status-live" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate text-[11px] font-medium">
                        {call.room.title}
                      </div>
                      <div className="text-muted-foreground truncate text-[10px]">
                        {call.project.key} · {call.participantCount}
                        {call.isParticipant ? ` · ${tLayout('joined')}` : ''}
                      </div>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
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
  const tLayout = useTranslations('layoutNav');
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
    () =>
      allParticipants.filter((participant) => participant.identity !== localParticipant.identity),
    [allParticipants, localParticipant.identity]
  );
  const participantDisplayCount = Math.max(effectiveParticipantCount, allParticipants.length || 1);
  const localMicrophoneLevel = isMicrophoneEnabled
    ? Math.min(1, localParticipant.audioLevel * 1.85)
    : 0;
  const deferredMicrophoneLevel = useDeferredValue(localMicrophoneLevel);
  const isActivelySpeaking = isMicrophoneEnabled && deferredMicrophoneLevel > 0.08;
  const resolvedConnectionState = liveConnectionState || connectionState;
  const microphoneStatusLabel =
    resolvedConnectionState !== 'connected'
      ? tLayout('voice.connecting')
      : isMicrophoneEnabled
        ? isActivelySpeaking
          ? tLayout('voice.sendingAudio')
          : tLayout('voice.micLive')
        : tLayout('voice.muted');
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
        ? tLayout('voice.systemDefaultMic')
        : storedAudioDeviceLabel || tLayout('voice.selectedMicUnavailable'))
    );
  }, [
    microphoneDevices,
    selectedAudioDeviceId,
    storedAudioDeviceGroupId,
    storedAudioDeviceLabel,
    tLayout,
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
    [
      microphoneDevices,
      onChangeAudioDevice,
      onStoreAudioDevicePreference,
      refreshMicrophoneEnvironment,
    ]
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
        error instanceof Error ? error.message : tLayout('voice.audioPlaybackError')
      );
    } finally {
      setIsStartingAudioPlayback(false);
    }
  }, [startAudio, tLayout]);

  return (
    <>
      <div className="bg-surface space-y-2 rounded-sm p-2">
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
            <div className="text-foreground truncate text-[11px] font-semibold">
              {currentTarget.roomTitle}
            </div>
            <div className="text-muted-foreground truncate text-[10px]">
              {currentTarget.projectName} ·{' '}
              {tLayout('voice.inCall', { count: participantDisplayCount })}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {resolvedConnectionState === 'connected' ? (
              <span className="live-pill text-[9px]">{tLayout('voice.live')}</span>
            ) : (
              <span className="chip text-[9px]">{tLayout('voice.offline')}</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground ease-snap h-6 w-6 rounded-sm px-0 transition-all duration-150"
              onClick={onOpenVoiceSettings}
              title={tLayout('voice.openVoiceSettings')}
              aria-label={tLayout('voice.openVoiceSettings')}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="bg-surface-2 flex items-center justify-between gap-2 rounded-sm px-2 py-2">
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
                  <div className="border-background bg-muted text-muted-foreground -ml-2 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold">
                    +{participantDisplayCount - participantsPreview.length}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-muted-foreground text-[10px]">
                {tLayout('voice.waitingForParticipants')}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.12em]">
              {tLayout('voice.voice')}
            </div>
            <div className="text-foreground pt-0.5 text-[11px] font-medium">
              {microphoneStatusLabel}
            </div>
          </div>
        </div>

        <div className="bg-surface-2 space-y-1 rounded-sm px-2 py-2">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="text-muted-foreground font-medium uppercase tracking-[0.12em]">
              {tLayout('voice.micLevel')}
            </span>
            <span className="text-muted-foreground">
              {Math.round(deferredMicrophoneLevel * 100)}%
            </span>
          </div>
          <div className="bg-muted/30 h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full transition-[width] duration-150',
                isActivelySpeaking ? 'bg-accent-emerald' : 'bg-foreground/80'
              )}
              style={{ width: `${Math.round(deferredMicrophoneLevel * 100)}%` }}
            />
          </div>
          <div className="text-muted-foreground truncate text-[10px]">
            {selectedMicrophoneLabel}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link href={currentTarget.roomHref} className="min-w-0 flex-1">
            <Button size="sm" variant="outline" className="h-6 w-full rounded-sm px-2 text-[11px]">
              <PhoneCall className="mr-1 h-3 w-3" />
              {tLayout('voice.room')}
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 rounded-sm px-0"
            onClick={onToggleMicrophone}
            disabled={resolvedConnectionState !== 'connected' || isTogglingMicrophone}
            title={isMicrophoneEnabled ? tLayout('voice.muteMic') : tLayout('voice.unmuteMic')}
            aria-label={isMicrophoneEnabled ? tLayout('voice.muteMic') : tLayout('voice.unmuteMic')}
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
            title={tLayout('voice.leaveCall')}
            aria-label={tLayout('voice.leaveCall')}
          >
            <PhoneOff className="h-3 w-3" />
          </Button>
        </div>

        {currentTarget.canManageCalls ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-5 w-full rounded-sm px-1.5 text-[10px]"
            onClick={onEndCurrentCall}
          >
            {tLayout('voice.endRoomForEveryone')}
          </Button>
        ) : null}

        {combinedRuntimeError ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-2 py-1.5 text-[11px]">
            {combinedRuntimeError}
          </div>
        ) : null}
      </div>

      <Dialog open={isVoiceSettingsOpen} onOpenChange={onVoiceSettingsOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tLayout('voice.meetingSettings')}</DialogTitle>
            <DialogDescription>{tLayout('voice.meetingSettingsDescription')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <div className="bg-surface rounded-md p-4">
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
                    <div className="text-foreground text-sm font-semibold">
                      {currentTarget.roomTitle}
                    </div>
                    <span className="text-muted-foreground rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.14em]">
                      {tLayout(connectionStateLabelKey(resolvedConnectionState))}
                    </span>
                  </div>
                  <div className="text-muted-foreground pt-1 text-xs">
                    {currentTarget.projectName} ·{' '}
                    {tLayout('voice.inCall', { count: participantDisplayCount })} ·{' '}
                    {microphoneStatusLabel}
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
                      {tLayout('voice.enableAudio')}
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
                    {isMicrophoneEnabled ? tLayout('voice.mute') : tLayout('voice.unmute')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-sm"
                    onClick={onLeaveCurrentCall}
                  >
                    <PhoneOff className="mr-2 h-4 w-4" />
                    {tLayout('voice.leave')}
                  </Button>
                  {currentTarget.canManageCalls ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm"
                      onClick={onEndCurrentCall}
                    >
                      {tLayout('voice.endRoom')}
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
              <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs">
                {combinedRuntimeError}
              </div>
            ) : null}

            <div className="bg-background rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-foreground text-sm font-semibold">
                    {tLayout('voice.microphone')}
                  </div>
                  <div className="text-muted-foreground pt-1 text-xs">
                    {tLayout('voice.chooseInputDevice')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.14em]">
                    {tLayout('voice.level')}
                  </div>
                  <div className="text-foreground pt-1 text-sm font-semibold tabular-nums">
                    {Math.round(deferredMicrophoneLevel * 100)}%
                  </div>
                </div>
              </div>

              <div className="bg-muted/25 mt-4 h-3 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full transition-[width] duration-150',
                    isActivelySpeaking ? 'bg-accent-emerald' : 'bg-foreground/80'
                  )}
                  style={{ width: `${Math.round(deferredMicrophoneLevel * 100)}%` }}
                />
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.14em]">
                  {tLayout('voice.inputDevice')}
                </label>
                <select
                  className="bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none"
                  value={selectedAudioDeviceId}
                  onChange={(event) => {
                    void handleSelectMicrophone(event.target.value);
                  }}
                  disabled={isChangingAudioDevice || isRefreshingMicrophoneEnvironment}
                >
                  <option value="default">{tLayout('voice.systemDefaultMic')}</option>
                  {microphoneDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label.trim() ||
                        tLayout('voice.microphoneNumbered', { number: index + 1 })}
                    </option>
                  ))}
                </select>
                <div className="text-muted-foreground text-xs">
                  {tLayout('voice.currentSelection')}{' '}
                  <span className="text-foreground font-medium">{selectedMicrophoneLabel}</span>
                </div>
              </div>

              <div className="bg-surface text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-xs">
                <div>
                  <span className="text-foreground font-medium">{tLayout('voice.permission')}</span>{' '}
                  {microphonePermissionLabel}
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
                      {tLayout('voice.unlockMicrophone')}
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
                    {tLayout('voice.refreshDevices')}
                  </Button>
                </div>
              </div>

              <div className="bg-surface text-muted-foreground mt-3 rounded-md px-3 py-2 text-xs">
                {microphonePermissionHelp}
                {microphoneDevices.length === 0 ? ` ${tLayout('voice.noMicrophonesVisible')}` : ''}
                {microphonePermissionState === 'granted' && !deviceLabelsVisible
                  ? ` ${tLayout('voice.labelsNotExposed')}`
                  : ''}
                {selectedAudioDeviceId !== 'default' && microphonePermissionState !== 'granted'
                  ? ` ${tLayout('voice.deviceSwitchingHint')}`
                  : ''}
              </div>
            </div>

            <div className="bg-background rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-foreground text-sm font-semibold">
                    {tLayout('voice.peopleInCall')}
                  </div>
                  <div className="text-muted-foreground pt-1 text-xs">
                    {tLayout('voice.speakingGlowHint')}
                  </div>
                </div>
                <div className="text-muted-foreground rounded-md border px-2 py-1 text-[11px] font-medium">
                  {tLayout('voice.totalCount', { count: participantDisplayCount })}
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
  const tLayout = useTranslations('layoutNav');
  const isConnecting = connectionState !== 'connected';
  const voiceStatusLabel = isConnecting
    ? tLayout('voice.connecting')
    : isMicrophoneEnabled
      ? tLayout('voice.micLive')
      : tLayout('voice.muted');

  return (
    <div className="bg-surface space-y-2 rounded-sm p-2">
      <div className="flex items-start gap-2">
        <span className="realtime-ping mt-1 shrink-0">
          <span className={cn('status-dot', isConnecting ? 'status-warn' : 'status-live')} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-[11px] font-semibold">
            {currentTarget.roomTitle}
          </div>
          <div className="text-muted-foreground truncate text-[10px]">
            {currentTarget.projectName} ·{' '}
            {tLayout('voice.inCall', { count: effectiveParticipantCount })}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-6 w-6 rounded-sm px-0"
          onClick={onOpenVoiceSettings}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="bg-surface-2 text-muted-foreground rounded-sm px-2 py-2 text-[10px]">
        {tLayout('voice.voiceStatus', { status: voiceStatusLabel })}
      </div>

      <div className="flex items-center gap-1">
        <Link href={currentTarget.roomHref} className="min-w-0 flex-1">
          <Button size="sm" variant="outline" className="h-6 w-full rounded-sm px-2 text-[11px]">
            <PhoneCall className="mr-1 h-3 w-3" />
            {tLayout('voice.room')}
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
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 rounded-sm px-0"
          onClick={onLeaveCurrentCall}
        >
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>

      {currentTarget.canManageCalls ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-5 w-full rounded-sm px-1.5 text-[10px]"
          onClick={onEndCurrentCall}
        >
          {tLayout('voice.endRoomForEveryone')}
        </Button>
      ) : null}

      {runtimeError ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-2 py-1.5 text-[11px]">
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
  const tLayout = useTranslations('layoutNav');
  const isSpeaking = useIsSpeaking(participant);
  const isMicrophoneActive = participant.isMicrophoneEnabled;
  const displayName =
    participant.name ||
    (isCurrentUser ? sessionUserName : null) ||
    participant.identity ||
    tLayout('voice.participant');

  return (
    <Avatar
      className={cn(
        'border-background h-7 w-7 border transition-[box-shadow,transform,background-color] duration-150',
        isSpeaking && isMicrophoneActive
          ? 'ring-accent-emerald/60 shadow-glow ring-2'
          : 'shadow-none',
        className
      )}
    >
      {isCurrentUser && sessionUserImage ? (
        <AvatarImage src={sessionUserImage} alt={displayName} />
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
  const tLayout = useTranslations('layoutNav');
  const isSpeaking = useIsSpeaking(participant);
  const displayName =
    participant.name ||
    (isCurrentUser ? sessionUserName : null) ||
    participant.identity ||
    tLayout('voice.participant');
  const isMicrophoneActive = participant.isMicrophoneEnabled;
  const stateLabel = isMicrophoneActive
    ? isSpeaking
      ? isCurrentUser
        ? tLayout('voice.sendingAudio')
        : tLayout('voice.speaking')
      : isCurrentUser
        ? tLayout('voice.micOn')
        : tLayout('voice.listening')
    : tLayout('voice.muted');

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150',
        isSpeaking && isMicrophoneActive
          ? 'border-accent-emerald/30 bg-accent-emerald/10 border'
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
          <div className="text-foreground truncate text-sm font-medium">{displayName}</div>
          {isCurrentUser ? (
            <span className="text-muted-foreground rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">
              {tLayout('voice.you')}
            </span>
          ) : null}
        </div>
        <div className="text-muted-foreground pt-0.5 text-xs">{stateLabel}</div>
      </div>

      {isMicrophoneActive ? (
        <Mic
          className={cn(
            'h-3.5 w-3.5',
            isSpeaking ? 'text-accent-emerald' : 'text-muted-foreground'
          )}
        />
      ) : (
        <MicOff className="text-muted-foreground h-3.5 w-3.5" />
      )}
    </div>
  );
}

function connectionStateLabelKey(state: string) {
  switch (state) {
    case 'connected':
      return 'voice.connectionState.connected';
    case 'connecting':
      return 'voice.connectionState.connecting';
    case 'reconnecting':
      return 'voice.connectionState.reconnecting';
    case 'disconnected':
      return 'voice.connectionState.disconnected';
    default:
      return 'voice.connectionState.voiceRoom';
  }
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

// Re-export locale-aware helpers for unit tests. These intentionally stay
// non-exported in the public surface (the component is the only consumer at
// runtime), but tests need to exercise the pure path-mapping logic directly.
export const __test__ = {
  stripLocalePrefix,
  getSectionKey,
  isHomeSectionPath,
  isNavLinkActive,
};
