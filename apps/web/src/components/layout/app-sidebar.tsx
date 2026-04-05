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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useLiveCalls } from '@/lib/hooks/use-chat';
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
  type MicrophoneDeviceOption,
  type MicrophonePermissionState,
} from '@/lib/chat/microphone';
import { useStoredVoicePreferences } from '@/lib/chat/voice-preferences';

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
    room,
    runtimeError,
    setAudioDeviceId,
    toggleMicrophone,
  } = useGlobalVoice();
  const { storedAudioDeviceId, storeAudioDeviceId } = useStoredVoicePreferences();
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
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="font-semibold text-foreground">TaskNebula</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
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

        <div className="pt-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </span>
            <Link href="/projects">
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="custom-scrollbar max-h-48 space-y-0.5 overflow-y-auto">
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
                      'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted">
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {project.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="flex-1 truncate">{project.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
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
            {projects && projects.length > 5 ? (
              <Link
                href="/projects"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                View all {projects.length} projects
              </Link>
            ) : null}
          </div>
        </div>
      </nav>

      {currentTarget || otherActiveCalls.length > 0 || sidebarRuntimeError ? (
        <div className="space-y-1.5 border-t border-border p-2">
          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Live Calls
          </div>

          {currentTarget && currentSession ? (
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
                  sessionUserImage={session?.user?.image}
                  sessionUserName={session?.user?.name}
                  onChangeAudioDevice={handleChangeAudioDevice}
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

      <div className="space-y-0.5 border-t border-border p-2">
        {isSuperAdmin ? (
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
        ) : null}

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

        <div className="cursor-pointer rounded-md px-2 py-2 transition-colors hover:bg-accent">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {session?.user?.image ? <AvatarImage src={session.user.image} /> : null}
              <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
                {session?.user?.name?.split(' ').map((part) => part[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{session?.user?.name || 'User'}</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </aside>
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
  sessionUserImage,
  sessionUserName,
  onChangeAudioDevice,
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
  sessionUserImage?: string | null;
  sessionUserName?: string | null;
  onChangeAudioDevice: (audioDeviceId: string) => Promise<void>;
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
    if (selectedAudioDeviceId === 'default') {
      return 'System default microphone';
    }
    const selectedDevice = microphoneDevices.find((device) => device.deviceId === selectedAudioDeviceId);
    return selectedDevice?.label?.trim() || 'Selected microphone unavailable';
  }, [microphoneDevices, selectedAudioDeviceId]);
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
    } catch (error) {
      setSettingsError(
        formatMicrophoneError(error, {
          userAgent,
        })
      );
    } finally {
      setIsRefreshingMicrophoneEnvironment(false);
    }
  }, [userAgent]);

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
        await onChangeAudioDevice(nextAudioDeviceId);
        await refreshMicrophoneEnvironment();
      } catch (error) {
        setSettingsError(formatMicrophoneError(error));
      } finally {
        setIsChangingAudioDevice(false);
      }
    },
    [onChangeAudioDevice, refreshMicrophoneEnvironment]
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
      <div className="space-y-2 rounded-sm border bg-muted/15 p-2">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
              resolvedConnectionState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-foreground">
              {currentTarget.roomTitle}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {currentTarget.projectName} · {participantDisplayCount} in call
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-sm border px-1 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              live
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 rounded-sm px-0 text-muted-foreground"
              onClick={onOpenVoiceSettings}
              title="Open voice settings"
              aria-label="Open voice settings"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-sm border bg-background/60 px-2 py-2">
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

        <div className="space-y-1 rounded-sm border bg-background/60 px-2 py-2">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Mic level
            </span>
            <span className="text-muted-foreground">{Math.round(deferredMicrophoneLevel * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/30">
            <div
              className={cn(
                'h-full transition-[width,background-color] duration-100',
                isActivelySpeaking ? 'bg-emerald-500' : 'bg-foreground/80'
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
            <div className="rounded-md border bg-muted/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        resolvedConnectionState === 'connected'
                          ? isActivelySpeaking
                            ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'
                            : 'bg-amber-500'
                          : 'bg-amber-500'
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
                    'h-full transition-[width,background-color] duration-100',
                    isActivelySpeaking ? 'bg-emerald-500' : 'bg-foreground/80'
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

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
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

              <div className="mt-3 rounded-md border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
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
    <div className="space-y-2 rounded-sm border bg-muted/15 p-2">
      <div className="flex items-start gap-2">
        <div className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', isConnecting ? 'bg-amber-500' : 'bg-emerald-500')} />
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

      <div className="rounded-sm border bg-background/60 px-2 py-2 text-[10px] text-muted-foreground">
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
        'h-7 w-7 border border-background transition-[box-shadow,transform,background-color]',
        isSpeaking && isMicrophoneActive
          ? 'shadow-[0_0_0_2px_rgba(34,197,94,0.9),0_0_14px_rgba(34,197,94,0.32)]'
          : 'shadow-none',
        className
      )}
    >
      {isCurrentUser && sessionUserImage ? <AvatarImage src={sessionUserImage} /> : null}
      <AvatarFallback
        className={cn(
          'text-[10px] font-semibold',
          isSpeaking && isMicrophoneActive
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
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
        'flex items-center gap-3 rounded-md border px-3 py-2',
        isSpeaking && isMicrophoneActive ? 'border-emerald-500/35 bg-emerald-500/5' : 'bg-muted/10'
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
        <Mic className={cn('h-3.5 w-3.5', isSpeaking ? 'text-emerald-500' : 'text-muted-foreground')} />
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
