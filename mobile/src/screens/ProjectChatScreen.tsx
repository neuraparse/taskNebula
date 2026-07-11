import { Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Archive,
  Check,
  Edit3,
  Hash,
  MessageCircle,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Plus,
  Radio,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { ConversationMessage, ProjectChatChannel, ProjectChatDiscussion } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useConversationMessages,
  useConversationStream,
  useCreateConversationMessage,
  useCreateProjectChatChannel,
  useDeleteConversationMessage,
  useDeleteProjectChatChannel,
  useEndConversationCall,
  useMarkConversationRead,
  useMe,
  useProjectChatBootstrap,
  useUpdateConversationMessage,
  useUpdateProjectChatChannel,
} from '@/hooks/queries';
import { useNativeConversationCall } from '@/hooks/livekit-call';
import type { AppStackParamList } from '@/navigation/types';

type ProjectChatProps = NativeStackScreenProps<AppStackParamList, 'ProjectChat'>;
type ProjectChatStyles = ReturnType<typeof createProjectChatStyles>;

const REACTION_SHORTCUTS = ['👍', '✅', '👀'] as const;

function useProjectChatTheme(): { colors: ThemeColors; styles: ProjectChatStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectChatStyles(colors), [colors]);

  return { colors, styles };
}

function formatMessageTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
}

function channelSubtitle(channel: ProjectChatChannel, t: ReturnType<typeof useTranslation>['t']) {
  if (channel.lastMessage) return channel.lastMessage.body;
  if (channel.description) return channel.description;
  return t('chat.noMessages');
}

function discussionContextValue(
  discussion: ProjectChatDiscussion,
  key: string,
): string | undefined {
  const value = discussion.context?.[key];
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

function discussionTitle(
  discussion: ProjectChatDiscussion,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return discussionContextValue(discussion, 'title') ?? discussion.title ?? t('chat.discussion');
}

function discussionSubtitle(
  discussion: ProjectChatDiscussion,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (discussion.kind === 'issue_thread') {
    return discussionContextValue(discussion, 'key') ?? t('chat.issueDiscussion');
  }
  if (discussion.kind === 'document_thread') return t('chat.documentDiscussion');
  return t('chat.discussion');
}

function ChannelChip({
  channel,
  onPress,
  selected,
}: {
  channel: ProjectChatChannel;
  onPress: () => void;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectChatTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.channelChip, selected ? styles.channelChipActive : null]}
      className="active:opacity-80"
    >
      <View style={styles.channelChipHeader}>
        <Hash size={14} color={selected ? colors.primaryForeground : colors.foreground} />
        <Text
          style={[styles.channelChipTitle, selected ? styles.channelChipTitleActive : null]}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {channel.unreadCount > 0 ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadText}>{channel.unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.channelChipSubtitle, selected ? styles.channelChipSubtitleActive : null]}
        numberOfLines={1}
      >
        {channelSubtitle(channel, t)}
      </Text>
    </Pressable>
  );
}

function DiscussionChip({
  discussion,
  onPress,
  selected,
}: {
  discussion: ProjectChatDiscussion;
  onPress: () => void;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectChatTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.channelChip, selected ? styles.channelChipActive : null]}
      className="active:opacity-80"
    >
      <View style={styles.channelChipHeader}>
        <MessageCircle size={14} color={selected ? colors.primaryForeground : colors.foreground} />
        <Text
          style={[styles.channelChipTitle, selected ? styles.channelChipTitleActive : null]}
          numberOfLines={1}
        >
          {discussionTitle(discussion, t)}
        </Text>
        {discussion.unreadCount > 0 ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadText}>{discussion.unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.channelChipSubtitle, selected ? styles.channelChipSubtitleActive : null]}
        numberOfLines={1}
      >
        {discussionSubtitle(discussion, t)}
      </Text>
    </Pressable>
  );
}

function MessageBubble({
  language,
  message,
  onDelete,
  onEdit,
  onReact,
  own,
}: {
  language: string;
  message: ConversationMessage;
  onDelete: () => void;
  onEdit: () => void;
  onReact: (emoji: string) => void;
  own: boolean;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectChatTheme();
  const author = message.author.name || message.author.email || t('chat.unknownUser');
  const deleted = Boolean(message.deletedAt);

  return (
    <View style={[styles.messageRow, own ? styles.messageRowOwn : null]}>
      <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : null]}>
        <View style={styles.messageMetaRow}>
          <Text
            style={[styles.messageAuthor, own ? styles.messageAuthorOwn : null]}
            numberOfLines={1}
          >
            {author}
          </Text>
          <Text style={[styles.messageTime, own ? styles.messageTimeOwn : null]}>
            {formatMessageTime(message.createdAt, language)}
            {message.editedAt ? ` ${t('chat.edited')}` : ''}
          </Text>
        </View>

        <Text style={[styles.messageBody, own ? styles.messageBodyOwn : null]}>
          {deleted ? t('chat.messageDeleted') : message.body}
        </Text>

        {message.attachments.length > 0 ? (
          <View style={styles.attachmentList}>
            {message.attachments.map((attachment) => (
              <View key={attachment.id} style={styles.attachmentPill}>
                <Text style={styles.attachmentText} numberOfLines={1}>
                  {attachment.fileName}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {message.reactions.length > 0 ? (
          <View style={styles.reactionRow}>
            {message.reactions.map((reaction) => (
              <View
                key={reaction.emoji}
                style={[
                  styles.reactionPill,
                  reaction.reactedByCurrentUser ? styles.reactionPillActive : null,
                ]}
              >
                <Text style={styles.reactionText}>
                  {reaction.emoji} {reaction.count}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!deleted ? (
          <View style={styles.messageActions}>
            {REACTION_SHORTCUTS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityLabel={t('chat.reactWith', { emoji })}
                accessibilityRole="button"
                onPress={() => onReact(emoji)}
                style={styles.reactionButton}
                className="active:opacity-80"
              >
                <Text style={styles.reactionButtonText}>{emoji}</Text>
              </Pressable>
            ))}
            {message.canEdit ? (
              <Pressable
                accessibilityLabel={t('chat.editMessage')}
                accessibilityRole="button"
                onPress={onEdit}
                style={styles.iconAction}
                className="active:opacity-80"
              >
                <Edit3 size={14} color={own ? colors.primaryForeground : colors.foreground} />
              </Pressable>
            ) : null}
            {message.canDelete ? (
              <Pressable
                accessibilityLabel={t('chat.deleteMessage')}
                accessibilityRole="button"
                onPress={onDelete}
                style={styles.iconAction}
                className="active:opacity-80"
              >
                <Trash2 size={14} color={own ? colors.primaryForeground : colors.destructive} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ChannelForm({
  busy,
  description,
  editing,
  name,
  onArchive,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSubmit,
}: {
  busy: boolean;
  description: string;
  editing: ProjectChatChannel | null;
  name: string;
  onArchive: () => void;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectChatTheme();
  return (
    <SurfaceRow className="gap-3">
      <View style={styles.formHeader}>
        <View style={styles.formTitleWrap}>
          <IconTile icon={editing ? Edit3 : Plus} tone="blue" />
          <View style={styles.formTitleText}>
            <Text style={styles.formTitle}>
              {editing ? t('chat.editChannel') : t('chat.newChannel')}
            </Text>
            <Text style={styles.formSubtitle}>
              {editing ? t('chat.editChannelHint') : t('chat.newChannelHint')}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={t('common.cancel')}
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.closeButton}
          className="active:opacity-80"
        >
          <X size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <TextField
        label={t('chat.channelName')}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('chat.channelNamePlaceholder')}
        autoCapitalize="words"
      />
      <TextField
        label={t('chat.channelDescription')}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={t('chat.channelDescriptionPlaceholder')}
        multiline
        style={styles.multilineInput}
      />

      <View style={styles.formActions}>
        {editing && !editing.isDefault ? (
          <Button
            title={t('chat.archiveChannel')}
            variant="destructive"
            icon={Archive}
            loading={busy}
            onPress={onArchive}
            style={styles.formButton}
          />
        ) : null}
        <Button
          title={editing ? t('common.save') : t('chat.createChannel')}
          icon={editing ? Save : Plus}
          loading={busy}
          onPress={onSubmit}
          style={styles.formButton}
        />
      </View>
    </SurfaceRow>
  );
}

export function ProjectChatScreen({ route }: ProjectChatProps) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useProjectChatTheme();
  const { projectId } = route.params;
  const routeRoomId = route.params.roomId?.trim() || null;
  const bootstrapQ = useProjectChatBootstrap(projectId);
  const meQ = useMe();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(routeRoomId);
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ProjectChatChannel | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<ConversationMessage | null>(null);
  const lastMarkedRef = useRef<string | null>(null);
  const appliedRouteRoomRef = useRef<string | null>(routeRoomId);

  const bootstrap = bootstrapQ.data;
  const channels = useMemo(() => bootstrap?.channels ?? [], [bootstrap?.channels]);
  const recentDiscussions = useMemo(
    () => bootstrap?.recentDiscussions ?? [],
    [bootstrap?.recentDiscussions],
  );
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.roomId === selectedRoomId) ?? null,
    [channels, selectedRoomId],
  );
  const selectedDiscussion = useMemo(
    () => recentDiscussions.find((discussion) => discussion.id === selectedRoomId) ?? null,
    [recentDiscussions, selectedRoomId],
  );
  const selectedRoom = useMemo(() => {
    if (selectedChannel) {
      return {
        title: selectedChannel.name,
        subtitle: selectedChannel.description || t('chat.projectChannel'),
        unreadCount: selectedChannel.unreadCount,
        participantCount: selectedChannel.participantCount,
        activeCall: selectedChannel.activeCall,
        icon: Hash,
      };
    }
    if (selectedDiscussion) {
      return {
        title: discussionTitle(selectedDiscussion, t),
        subtitle: discussionSubtitle(selectedDiscussion, t),
        unreadCount: selectedDiscussion.unreadCount,
        participantCount: selectedDiscussion.participantCount,
        activeCall: selectedDiscussion.activeCall,
        icon: MessageCircle,
      };
    }
    return null;
  }, [selectedChannel, selectedDiscussion, t]);
  const messagesQ = useConversationMessages(selectedRoomId);
  const createMessage = useCreateConversationMessage(projectId, selectedRoomId);
  const updateMessage = useUpdateConversationMessage(projectId, selectedRoomId);
  const deleteMessage = useDeleteConversationMessage(projectId, selectedRoomId);
  const markRead = useMarkConversationRead(projectId, selectedRoomId);
  const markReadMutate = markRead.mutate;
  const createChannel = useCreateProjectChatChannel(projectId);
  const updateChannel = useUpdateProjectChatChannel(projectId);
  const deleteChannel = useDeleteProjectChatChannel(projectId);
  const endCall = useEndConversationCall(projectId, selectedRoomId);
  const refetchChatBootstrap = bootstrapQ.refetch;
  const refreshCallState = useCallback(() => {
    void refetchChatBootstrap();
  }, [refetchChatBootstrap]);
  const voiceCall = useNativeConversationCall({ onCallChanged: refreshCallState });
  const stream = useConversationStream(
    projectId,
    selectedRoomId,
    Boolean(bootstrap?.effectiveSettings.enabled && bootstrap.permissions.canBrowseChat),
  );
  const messages = messagesQ.data ?? [];
  const latestMessageId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    if (!routeRoomId) {
      appliedRouteRoomRef.current = null;
      return;
    }
    if (appliedRouteRoomRef.current === routeRoomId) return;
    appliedRouteRoomRef.current = routeRoomId;
    setSelectedRoomId(routeRoomId);
  }, [routeRoomId]);

  useEffect(() => {
    if (selectedRoomId || !bootstrap) return;
    const lastActiveRoomExists = bootstrap.lastActiveRoomId
      ? bootstrap.channels.some((channel) => channel.roomId === bootstrap.lastActiveRoomId)
      : false;
    const fallbackRoom =
      (lastActiveRoomExists ? bootstrap.lastActiveRoomId : null) ??
      bootstrap.channels.find((channel) => channel.roomId)?.roomId ??
      null;
    setSelectedRoomId(fallbackRoom);
  }, [bootstrap, selectedRoomId]);

  useEffect(() => {
    if (!latestMessageId || !selectedRoomId || latestMessageId === lastMarkedRef.current) return;
    lastMarkedRef.current = latestMessageId;
    markReadMutate(latestMessageId);
  }, [latestMessageId, markReadMutate, selectedRoomId]);

  const resetChannelForm = () => {
    setChannelFormOpen(false);
    setEditingChannel(null);
    setChannelName('');
    setChannelDescription('');
  };

  const openChannelForm = (channel: ProjectChatChannel | null = null) => {
    setEditingChannel(channel);
    setChannelName(channel?.name ?? '');
    setChannelDescription(channel?.description ?? '');
    setChannelFormOpen(true);
  };

  const submitChannel = () => {
    const name = channelName.trim();
    if (!name) {
      Alert.alert(t('chat.channelNameRequired'));
      return;
    }
    const description = channelDescription.trim() || null;
    if (editingChannel) {
      updateChannel.mutate(
        {
          channelId: editingChannel.id,
          input: { name, description },
        },
        { onSuccess: resetChannelForm },
      );
      return;
    }
    createChannel.mutate(
      { name, description },
      {
        onSuccess: (channel) => {
          resetChannelForm();
          setSelectedRoomId(channel.roomId);
        },
      },
    );
  };

  const confirmArchiveChannel = () => {
    if (!editingChannel) return;
    Alert.alert(t('chat.archiveChannelTitle'), t('chat.archiveChannelDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.archiveChannel'),
        style: 'destructive',
        onPress: () => {
          deleteChannel.mutate(editingChannel.id, {
            onSuccess: () => {
              if (selectedRoomId === editingChannel.roomId) setSelectedRoomId(null);
              resetChannelForm();
            },
          });
        },
      },
    ]);
  };

  const sendMessage = () => {
    const body = draft.trim();
    if (!body || !selectedRoomId) return;
    if (editingMessage) {
      updateMessage.mutate(
        { messageId: editingMessage.id, input: { body } },
        {
          onSuccess: () => {
            setDraft('');
            setEditingMessage(null);
          },
        },
      );
      return;
    }
    createMessage.mutate(
      { body },
      {
        onSuccess: () => {
          setDraft('');
        },
      },
    );
  };

  const confirmDeleteMessage = (message: ConversationMessage) => {
    Alert.alert(t('chat.deleteMessageTitle'), t('chat.deleteMessageDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.deleteMessage'),
        style: 'destructive',
        onPress: () => deleteMessage.mutate(message.id),
      },
    ]);
  };

  const beginEditMessage = (message: ConversationMessage) => {
    setEditingMessage(message);
    setDraft(message.body);
  };

  const cancelEditMessage = () => {
    setEditingMessage(null);
    setDraft('');
  };

  const showCallError = (error: unknown) => {
    Alert.alert(
      t('chat.callActionFailedTitle'),
      error instanceof Error ? error.message : t('chat.callActionFailedDescription'),
    );
  };

  const joinSelectedCall = () => {
    if (!selectedRoomId || !selectedRoom) return;
    void voiceCall
      .join({ roomId: selectedRoomId, roomTitle: selectedRoom.title })
      .catch(showCallError);
  };

  const leaveSelectedCall = () => {
    void voiceCall.leave().catch(showCallError);
  };

  const toggleSelectedMute = () => {
    void voiceCall.setMuted(!voiceCall.muted).catch(showCallError);
  };

  const confirmEndCall = () => {
    if (!selectedRoomId) return;
    Alert.alert(t('chat.endCallTitle'), t('chat.endCallDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.endCall'),
        style: 'destructive',
        onPress: () =>
          endCall.mutate(undefined, {
            onError: showCallError,
            onSuccess: () => {
              if (selectedVoiceSession) {
                void voiceCall.leave().catch(showCallError);
              }
            },
          }),
      },
    ]);
  };

  if (bootstrapQ.isLoading) return <Loading label={t('chat.loading')} />;
  if (bootstrapQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={bootstrapQ.error instanceof Error ? bootstrapQ.error.message : t('common.retry')}
          onRetry={() => void bootstrapQ.refetch()}
        />
      </Screen>
    );
  }

  if (!bootstrap?.effectiveSettings.enabled || !bootstrap.permissions.canBrowseChat) {
    return (
      <Screen>
        <ScreenHeader
          kicker={bootstrap?.project.key ?? t('projects.title')}
          title={t('chat.title')}
          subtitle={t('chat.disabledSubtitle')}
        />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={MessageCircle}
            title={t('chat.disabledTitle')}
            description={t('chat.disabledDescription')}
          />
        </View>
      </Screen>
    );
  }

  const renderMessage: ListRenderItem<ConversationMessage> = ({ item }) => (
    <MessageBubble
      language={i18n.language}
      message={item}
      own={item.author.id === meQ.data?.id}
      onDelete={() => confirmDeleteMessage(item)}
      onEdit={() => beginEditMessage(item)}
      onReact={(emoji) =>
        updateMessage.mutate({ messageId: item.id, input: { reactionEmoji: emoji } })
      }
    />
  );

  const callBusy = voiceCall.isBusy || endCall.isPending;
  const selectedActiveCall = selectedRoom?.activeCall ?? null;
  const selectedVoiceSession =
    voiceCall.session?.roomId === selectedRoomId ? voiceCall.session : null;
  const connectedElsewhere =
    voiceCall.session && voiceCall.session.roomId !== selectedRoomId ? voiceCall.session : null;
  const selectedVoiceStatus = selectedVoiceSession
    ? voiceCall.status === 'connecting'
      ? t('chat.callStatusConnecting')
      : voiceCall.status === 'reconnecting'
        ? t('chat.callStatusReconnecting')
        : voiceCall.muted
          ? t('chat.callStatusMuted')
          : t('chat.callStatusConnected')
    : null;
  const canEndSelectedCall = Boolean(
    selectedActiveCall &&
      (bootstrap.permissions.canManageCalls || bootstrap.permissions.canStartCalls),
  );

  const header = (
    <View>
      <ScreenHeader
        kicker={bootstrap.project.key}
        title={t('chat.title')}
        subtitle={bootstrap.project.name}
        meta={
          <SemanticBadge
            label={stream.isConnected ? t('chat.live') : t('chat.polling')}
            tone={stream.isConnected ? 'emerald' : 'neutral'}
          />
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.channelRail}
      >
        {channels.map((channel) => (
          <ChannelChip
            key={channel.id}
            channel={channel}
            selected={channel.roomId === selectedRoomId}
            onPress={() => setSelectedRoomId(channel.roomId)}
          />
        ))}
      </ScrollView>

      {recentDiscussions.length > 0 ? (
        <View style={styles.discussionSection}>
          <Text style={styles.discussionSectionTitle}>{t('chat.recentDiscussions')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelRail}
          >
            {recentDiscussions.map((discussion) => (
              <DiscussionChip
                key={discussion.id}
                discussion={discussion}
                selected={discussion.id === selectedRoomId}
                onPress={() => setSelectedRoomId(discussion.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.headerActions}>
        {bootstrap.permissions.canCreateChannels ? (
          <Button
            title={t('chat.newChannel')}
            icon={Plus}
            variant="secondary"
            onPress={() => openChannelForm()}
            style={styles.headerButton}
          />
        ) : null}
        {selectedChannel && bootstrap.permissions.canCreateChannels ? (
          <Button
            title={t('chat.editChannel')}
            icon={Edit3}
            variant="secondary"
            onPress={() => openChannelForm(selectedChannel)}
            style={styles.headerButton}
          />
        ) : null}
      </View>

      {selectedRoom ? (
        <SurfaceRow className="gap-3">
          <View style={styles.roomHeader}>
            <View style={styles.roomTitleWrap}>
              <IconTile icon={selectedRoom.icon} tone="cyan" />
              <View style={styles.roomTitleText}>
                <Text style={styles.roomTitle}>{selectedRoom.title}</Text>
                <Text style={styles.roomSubtitle} numberOfLines={2}>
                  {selectedRoom.subtitle}
                </Text>
              </View>
            </View>
            {selectedRoom.activeCall ? (
              <SemanticBadge label={t('chat.activeCall')} tone="emerald" />
            ) : null}
          </View>
          <View style={styles.roomStats}>
            <View style={styles.roomStat}>
              <MessageCircle size={14} color={colors.mutedForeground} />
              <Text style={styles.roomStatText}>
                {t('chat.unreadCount', { count: selectedRoom.unreadCount })}
              </Text>
            </View>
            <View style={styles.roomStat}>
              <Radio size={14} color={colors.mutedForeground} />
              <Text style={styles.roomStatText}>
                {t('chat.presenceCount', { count: selectedRoom.participantCount })}
              </Text>
            </View>
          </View>
          {bootstrap.effectiveSettings.voiceEnabled ? (
            <View style={styles.callPanel}>
              <View style={styles.callCopy}>
                <View style={styles.callTitleRow}>
                  <PhoneCall size={15} color={colors.foreground} />
                  <Text style={styles.callTitle}>
                    {selectedActiveCall ? t('chat.callLiveTitle') : t('chat.callReadyTitle')}
                  </Text>
                </View>
                <Text style={styles.callDescription}>
                  {selectedActiveCall
                    ? t('chat.callLiveDescription', {
                        count: selectedActiveCall.participantCount,
                      })
                    : t('chat.callReadyDescription')}
                </Text>
                {selectedVoiceStatus ? (
                  <Text style={styles.callStatus}>{selectedVoiceStatus}</Text>
                ) : null}
                {connectedElsewhere ? (
                  <Text style={styles.callStatus}>
                    {t('chat.callConnectedElsewhere', { room: connectedElsewhere.roomTitle })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.callActions}>
                {!selectedVoiceSession &&
                (selectedActiveCall || bootstrap.permissions.canStartCalls) ? (
                  <Button
                    title={selectedActiveCall ? t('chat.joinCall') : t('chat.startCall')}
                    icon={PhoneCall}
                    loading={voiceCall.status === 'connecting'}
                    disabled={callBusy}
                    onPress={joinSelectedCall}
                    style={styles.callButton}
                  />
                ) : null}
                {selectedVoiceSession ? (
                  <Button
                    title={voiceCall.muted ? t('chat.unmuteCall') : t('chat.muteCall')}
                    icon={voiceCall.muted ? Mic : MicOff}
                    variant="secondary"
                    disabled={callBusy || voiceCall.status === 'reconnecting'}
                    onPress={toggleSelectedMute}
                    style={styles.callButton}
                  />
                ) : null}
                {selectedVoiceSession ? (
                  <Button
                    title={t('chat.leaveCall')}
                    icon={PhoneOff}
                    variant="secondary"
                    loading={voiceCall.status === 'leaving'}
                    disabled={callBusy}
                    onPress={leaveSelectedCall}
                    style={styles.callButton}
                  />
                ) : null}
                {canEndSelectedCall ? (
                  <Button
                    title={t('chat.endCall')}
                    icon={PhoneOff}
                    variant="destructive"
                    loading={endCall.isPending}
                    disabled={callBusy}
                    onPress={confirmEndCall}
                    style={styles.callButton}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </SurfaceRow>
      ) : null}

      {channelFormOpen ? (
        <View style={styles.channelFormWrap}>
          <ChannelForm
            busy={createChannel.isPending || updateChannel.isPending || deleteChannel.isPending}
            description={channelDescription}
            editing={editingChannel}
            name={channelName}
            onArchive={confirmArchiveChannel}
            onCancel={resetChannelForm}
            onDescriptionChange={setChannelDescription}
            onNameChange={setChannelName}
            onSubmit={submitChannel}
          />
        </View>
      ) : null}

      {messagesQ.hasMore ? (
        <View style={styles.loadMoreWrap}>
          <Button
            title={t('chat.loadOlder')}
            icon={MessageCircle}
            variant="secondary"
            loading={messagesQ.isLoadingMore}
            onPress={() => void messagesQ.loadMore()}
          />
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.composerWrap}>
      {editingMessage ? (
        <View style={styles.editBanner}>
          <View style={styles.editBannerText}>
            <Text style={styles.editBannerTitle}>{t('chat.editingMessage')}</Text>
            <Text style={styles.editBannerBody} numberOfLines={1}>
              {editingMessage.body}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t('chat.cancelEdit')}
            accessibilityRole="button"
            onPress={cancelEditMessage}
            style={styles.closeButton}
            className="active:opacity-80"
          >
            <X size={16} color={colors.foreground} />
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composerRow}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder={
              selectedChannel
                ? t('chat.composerPlaceholderChannel', { channel: selectedChannel.name })
                : t('chat.composerPlaceholder')
            }
            multiline
            editable={Boolean(selectedRoomId && bootstrap.permissions.canPostMessages)}
            style={styles.composerInput}
          />
          <Pressable
            accessibilityLabel={editingMessage ? t('chat.saveMessage') : t('chat.sendMessage')}
            accessibilityRole="button"
            disabled={
              !draft.trim() ||
              !selectedRoomId ||
              !bootstrap.permissions.canPostMessages ||
              createMessage.isPending ||
              updateMessage.isPending
            }
            onPress={sendMessage}
            style={[
              styles.sendButton,
              !draft.trim() || !selectedRoomId || !bootstrap.permissions.canPostMessages
                ? styles.sendButtonDisabled
                : null,
            ]}
            className="active:opacity-80"
          >
            {editingMessage ? (
              <Check size={20} color={colors.primaryForeground} />
            ) : (
              <Send size={20} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {!bootstrap.permissions.canPostMessages ? (
        <Text style={styles.noPostHint}>{t('chat.noPostPermission')}</Text>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={bootstrapQ.isRefetching || messagesQ.isRefetching}
            onRefresh={() => {
              void bootstrapQ.refetch();
              void messagesQ.refetch();
            }}
          />
        }
        ListEmptyComponent={
          messagesQ.isLoading ? (
            <Loading label={t('chat.loadingMessages')} />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={MessageCircle}
                title={selectedRoomId ? t('chat.emptyTitle') : t('chat.noChannelTitle')}
                description={
                  selectedRoomId ? t('chat.emptyDescription') : t('chat.noChannelDescription')
                }
              />
            </View>
          )
        }
      />
    </Screen>
  );
}

function createProjectChatStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 24,
    },
    channelRail: {
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    discussionSection: {
      gap: 2,
    },
    discussionSectionTitle: {
      paddingHorizontal: 16,
      paddingTop: 4,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    channelChip: {
      width: 220,
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    channelChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    channelChipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    channelChipTitle: {
      flex: 1,
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    channelChipTitleActive: {
      color: colors.primaryForeground,
    },
    channelChipSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    channelChipSubtitleActive: {
      color: colors.primaryForeground,
      opacity: 0.82,
    },
    unreadPill: {
      minWidth: 22,
      alignItems: 'center',
      borderRadius: 999,
      backgroundColor: colors.accentRose,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    unreadText: {
      color: colors.destructiveForeground,
      fontSize: 11,
      fontWeight: '700',
    },
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerButton: {
      minWidth: 150,
    },
    roomHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    roomTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      gap: 10,
    },
    roomTitleText: {
      flex: 1,
      gap: 2,
    },
    roomTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
    },
    roomSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    roomStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    roomStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    roomStatText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
    },
    callPanel: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.muted,
      padding: 12,
    },
    callCopy: {
      gap: 4,
    },
    callTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    callTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
    },
    callDescription: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    callStatus: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    callActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    callButton: {
      minWidth: 132,
    },
    channelFormWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    formTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    formTitleText: {
      flex: 1,
      gap: 2,
    },
    formTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
    },
    formSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    closeButton: {
      height: 34,
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.secondary,
    },
    multilineInput: {
      minHeight: 86,
      paddingTop: 10,
      textAlignVertical: 'top',
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    formButton: {
      minWidth: 150,
    },
    loadMoreWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    messageRow: {
      alignItems: 'flex-start',
      paddingHorizontal: 16,
    },
    messageRowOwn: {
      alignItems: 'flex-end',
    },
    messageBubble: {
      maxWidth: '88%',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 12,
    },
    messageBubbleOwn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    messageMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    messageAuthor: {
      flex: 1,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
    },
    messageAuthorOwn: {
      color: colors.primaryForeground,
    },
    messageTime: {
      color: colors.mutedForeground,
      fontSize: 11,
    },
    messageTimeOwn: {
      color: colors.primaryForeground,
      opacity: 0.76,
    },
    messageBody: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 21,
    },
    messageBodyOwn: {
      color: colors.primaryForeground,
    },
    attachmentList: {
      gap: 6,
    },
    attachmentPill: {
      alignSelf: 'flex-start',
      borderRadius: 4,
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    attachmentText: {
      maxWidth: 220,
      color: colors.secondaryForeground,
      fontSize: 12,
      fontWeight: '600',
    },
    reactionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    reactionPill: {
      borderRadius: 999,
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    reactionPillActive: {
      backgroundColor: colors.accentAmber,
    },
    reactionText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
    },
    messageActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingTop: 2,
    },
    reactionButton: {
      height: 28,
      minWidth: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
    },
    reactionButtonText: {
      fontSize: 14,
    },
    iconAction: {
      height: 28,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.secondary,
    },
    composerWrap: {
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    composerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    composerInput: {
      minHeight: 48,
      maxHeight: 132,
      flex: 1,
      paddingTop: 10,
      textAlignVertical: 'top',
    },
    sendButton: {
      height: 48,
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
      opacity: 0.48,
    },
    editBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 10,
    },
    editBannerText: {
      flex: 1,
      gap: 2,
    },
    editBannerTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
    },
    editBannerBody: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    noPostHint: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    emptyWrap: {
      padding: 20,
    },
  });
}
