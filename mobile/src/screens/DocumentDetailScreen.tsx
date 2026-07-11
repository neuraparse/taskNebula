import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import { useMemo, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpenText,
  ChevronRight,
  ExternalLink,
  File,
  FileText,
  Globe2,
  History,
  Link2,
  ListTodo,
  Paperclip,
  Pencil,
  Plus,
  RefreshCcw,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  DocumentAttachment,
  DocumentPage,
  DocumentRevision,
  DocumentTreeNode,
} from '@/api/types';
import { DocumentRichContent } from '@/components/document-rich-content';
import {
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  Button,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useDeleteDocumentAttachment,
  useDocumentAttachments,
  useDocumentPage,
  useDocumentRevisions,
  useDocumentTree,
  useRestoreDocumentRevision,
  useUpdateDocumentShare,
  useUploadDocumentAttachment,
} from '@/hooks/queries';
import { documentContentToPlainText } from '@/lib/document-content';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';
import { getBaseUrl } from '@/api/client';

type DocumentDetailProps = NativeStackScreenProps<AppStackParamList, 'DocumentDetail'>;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
type DocumentDetailStyles = ReturnType<typeof createDocumentDetailStyles>;

function useDocumentDetailTheme(): { colors: ThemeColors; styles: DocumentDetailStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createDocumentDetailStyles(colors), [colors]);
  return { colors, styles };
}

function contentText(page: DocumentPage): string {
  return (
    documentContentToPlainText(page.contentJson) ||
    page.contentText?.trim() ||
    page.excerpt?.trim() ||
    ''
  );
}

function DocumentContent({ page }: { page: DocumentPage }) {
  return (
    <DocumentRichContent
      baseUrl={getBaseUrl()}
      contentJson={page.contentJson}
      fallbackText={contentText(page)}
    />
  );
}

function formatAttachmentSize(bytes: number, t: ReturnType<typeof useTranslation>['t']): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return t('issueAttachments.sizeBytes', { count: 0 });
  if (bytes < 1024) return t('issueAttachments.sizeBytes', { count: bytes });
  const units = [
    t('issueAttachments.sizeKb'),
    t('issueAttachments.sizeMb'),
    t('issueAttachments.sizeGb'),
  ];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return t('issueAttachments.sizeValue', {
    value: Number(value.toFixed(1)),
    unit: units[unitIndex],
  });
}

function resolveWebUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  try {
    const parsed = new URL(pathOrUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Relative path.
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${path}`;
}

function shortRevisionId(revisionId: string): string {
  return revisionId.slice(0, 7);
}

function revisionCommitMessage(
  revision: DocumentRevision,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (revision.changeSummary?.trim()) return revision.changeSummary.trim();
  if (revision.revision === 1) {
    return t('docs.revisionInitialDraft', { title: revision.title });
  }
  return t('docs.revisionUpdated', { title: revision.title });
}

function revisionPreview(
  revision: DocumentRevision,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return revision.excerpt?.trim() || revision.contentText?.trim() || t('docs.revisionNoPreview');
}

function revisionAuthor(
  revision: DocumentRevision,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return (
    revision.author?.name?.trim() ||
    revision.author?.email?.trim() ||
    t('docs.revisionUnknownAuthor')
  );
}

function findDocumentTreeNode(nodes: DocumentTreeNode[], pageId: string): DocumentTreeNode | null {
  for (const node of nodes) {
    if (node.id === pageId) return node;
    const child = findDocumentTreeNode(node.children, pageId);
    if (child) return child;
  }
  return null;
}

function ShareOptionRow({
  description,
  disabled,
  enabled,
  icon: Icon,
  onPress,
  title,
}: {
  description: string;
  disabled: boolean;
  enabled: boolean;
  icon: LucideIcon;
  onPress: () => void;
  title: string;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.shareRow, disabled ? styles.shareRowDisabled : null]}
      className="active:opacity-80"
    >
      <View style={styles.shareRowIcon}>
        <Icon size={15} color={enabled ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.shareRowBody}>
        <Text style={styles.shareRowTitle}>{title}</Text>
        <Text style={styles.shareRowDescription}>{description}</Text>
      </View>
      <SemanticBadge
        label={enabled ? t('docs.shareOptionEnabled') : t('docs.shareOptionDisabled')}
        tone={enabled ? 'emerald' : 'neutral'}
      />
    </Pressable>
  );
}

function DocumentSharePanel({ page }: { page: DocumentPage }) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();
  const updateShare = useUpdateDocumentShare(page.id);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const share = page.share;

  if (!share || (!share.canManagePublic && !share.public.enabled)) return null;

  const publicUrl = resolveWebUrl(share.public.urlPath);
  const published = share.public.publishedAt ? relativeTime(share.public.publishedAt) : null;

  const patchShare = async (
    input: Parameters<typeof updateShare.mutateAsync>[0],
    noticeKey: string,
  ) => {
    setShareError(null);
    setShareNotice(null);
    try {
      await updateShare.mutateAsync(input);
      setShareNotice(t(noticeKey));
    } catch (err: unknown) {
      setShareError(err instanceof Error ? err.message : t('docs.shareUpdateFailed'));
    }
  };

  const openPublicLink = async () => {
    setShareError(null);
    if (!publicUrl) {
      setShareError(t('docs.shareLinkUnavailable'));
      return;
    }
    try {
      await Linking.openURL(publicUrl);
    } catch {
      setShareError(t('docs.shareLinkUnavailable'));
    }
  };

  const nativeSharePublicLink = async () => {
    setShareError(null);
    if (!publicUrl) {
      setShareError(t('docs.shareLinkUnavailable'));
      return;
    }
    try {
      await Share.share({ title: page.title, message: publicUrl, url: publicUrl });
    } catch {
      setShareError(t('docs.shareLinkUnavailable'));
    }
  };

  const confirmRegenerate = () => {
    Alert.alert(t('docs.shareRegenerateConfirmTitle'), t('docs.shareRegenerateConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('docs.shareRegenerate'),
        onPress: () => {
          void patchShare({ regenerateToken: true }, 'docs.shareRegeneratedNotice');
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.shareHeader}>
        <View style={styles.sectionTitle}>
          <Globe2 size={16} color={colors.foreground} />
          <Text className="text-foreground text-base font-semibold">{t('docs.shareTitle')}</Text>
        </View>
        <SemanticBadge
          label={
            share.public.enabled ? t('docs.sharePublicEnabled') : t('docs.sharePublicDisabled')
          }
          tone={share.public.enabled ? 'emerald' : 'neutral'}
        />
      </View>

      <Text style={styles.metaText}>{t('docs.shareDescription')}</Text>
      {published ? (
        <Text style={styles.metaText}>{t('docs.sharePublished', { date: published })}</Text>
      ) : null}

      <View style={styles.shareActions}>
        {share.canManagePublic ? (
          <Button
            title={share.public.enabled ? t('docs.shareDisable') : t('docs.shareEnable')}
            icon={Globe2}
            variant={share.public.enabled ? 'secondary' : 'primary'}
            loading={updateShare.isPending}
            disabled={updateShare.isPending}
            onPress={() => {
              void patchShare(
                { enablePublic: !share.public.enabled },
                share.public.enabled ? 'docs.shareDisabledNotice' : 'docs.shareEnabledNotice',
              );
            }}
          />
        ) : null}
        {share.public.enabled ? (
          <>
            <Button
              title={t('docs.shareOpenPublic')}
              icon={ExternalLink}
              variant="secondary"
              onPress={() => {
                void openPublicLink();
              }}
            />
            <Button
              title={t('docs.shareNativeShare')}
              icon={Share2}
              variant="secondary"
              onPress={() => {
                void nativeSharePublicLink();
              }}
            />
          </>
        ) : null}
      </View>

      {share.canManagePublic && share.public.enabled ? (
        <View style={styles.shareOptions}>
          <Text style={styles.shareOptionsTitle}>{t('docs.shareOptionsTitle')}</Text>
          <ShareOptionRow
            icon={Search}
            title={t('docs.shareSearchIndexingTitle')}
            description={t('docs.shareSearchIndexingDesc')}
            enabled={share.public.allowSearchIndexing}
            disabled={updateShare.isPending}
            onPress={() => {
              void patchShare(
                { allowSearchIndexing: !share.public.allowSearchIndexing },
                'docs.shareOptionUpdatedNotice',
              );
            }}
          />
          <ShareOptionRow
            icon={Paperclip}
            title={t('docs.shareIncludeAttachmentsTitle')}
            description={t('docs.shareIncludeAttachmentsDesc')}
            enabled={share.public.includeAttachments}
            disabled={updateShare.isPending}
            onPress={() => {
              void patchShare(
                { includeAttachments: !share.public.includeAttachments },
                'docs.shareOptionUpdatedNotice',
              );
            }}
          />
          <Button
            title={t('docs.shareRegenerate')}
            icon={RefreshCw}
            variant="ghost"
            disabled={updateShare.isPending}
            onPress={confirmRegenerate}
          />
        </View>
      ) : null}

      {shareNotice ? <Text style={styles.shareNotice}>{shareNotice}</Text> : null}
      {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}
    </View>
  );
}

function DocumentAttachmentsPanel({
  canDelete,
  canEdit,
  pageId,
}: {
  canDelete: boolean;
  canEdit: boolean;
  pageId: string;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();
  const attachmentsQ = useDocumentAttachments(pageId);
  const uploadAttachment = useUploadDocumentAttachment(pageId);
  const deleteAttachment = useDeleteDocumentAttachment(pageId);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const uploadPickedAttachment = async () => {
    setAttachmentError(null);
    try {
      const [file] = await pick();
      if (file.size !== null && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(t('docs.attachmentMaxSize'));
        return;
      }
      if (file.error) {
        setAttachmentError(t('docs.attachmentUploadFailed'));
        return;
      }

      const uriFileName = decodeURIComponent(file.uri.split('/').filter(Boolean).pop() ?? '');
      const fileName = file.name ?? (uriFileName || `attachment-${Date.now()}`);
      await uploadAttachment.mutateAsync({
        uri: file.uri,
        name: fileName,
        type: file.type,
        size: file.size,
      });
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      setAttachmentError(err instanceof Error ? err.message : t('docs.attachmentUploadFailed'));
    }
  };

  const openAttachment = async (attachment: DocumentAttachment) => {
    setAttachmentError(null);
    const fileName = attachment.filePath.split('/').filter(Boolean).pop();
    const baseUrl = getBaseUrl();
    if (!fileName || !baseUrl) {
      setAttachmentError(t('docs.attachmentOpenFailed'));
      return;
    }
    try {
      await Linking.openURL(`${baseUrl}/api/uploads/${encodeURIComponent(fileName)}`);
    } catch {
      setAttachmentError(t('docs.attachmentOpenFailed'));
    }
  };

  const deleteAttachmentAsync = async (attachment: DocumentAttachment) => {
    setAttachmentError(null);
    try {
      await deleteAttachment.mutateAsync(attachment.id);
    } catch (err: unknown) {
      setAttachmentError(err instanceof Error ? err.message : t('docs.attachmentDeleteFailed'));
    }
  };

  const confirmDeleteAttachment = (attachment: DocumentAttachment) => {
    Alert.alert(
      t('docs.attachmentDeleteConfirmTitle'),
      t('docs.attachmentDeleteConfirmMessage', { name: attachment.fileName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('docs.attachmentDelete'),
          style: 'destructive',
          onPress: () => {
            void deleteAttachmentAsync(attachment);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.attachmentsHeader}>
        <View style={styles.attachmentsHeaderText}>
          <View style={styles.sectionTitle}>
            <File size={16} color={colors.foreground} />
            <Text className="text-foreground text-base font-semibold">{t('docs.attachments')}</Text>
          </View>
          {attachmentsQ.data && attachmentsQ.data.length > 0 ? (
            <Text style={styles.metaText}>
              {t('docs.attachmentCount', { count: attachmentsQ.data.length })}
            </Text>
          ) : null}
        </View>
        {canEdit ? (
          <Button
            title={t('docs.attachmentBrowse')}
            icon={Upload}
            variant="secondary"
            loading={uploadAttachment.isPending}
            disabled={uploadAttachment.isPending}
            onPress={() => {
              void uploadPickedAttachment();
            }}
          />
        ) : null}
      </View>
      {canEdit ? <Text style={styles.metaText}>{t('docs.attachmentMaxSize')}</Text> : null}

      {attachmentsQ.isLoading ? <Text style={styles.metaText}>{t('common.loading')}</Text> : null}
      {attachmentsQ.isError ? (
        <Text style={styles.errorText}>{t('docs.attachmentLoadFailed')}</Text>
      ) : null}
      {!attachmentsQ.isLoading && !attachmentsQ.isError && attachmentsQ.data?.length === 0 ? (
        <Text style={styles.metaText}>{t('docs.attachmentsEmpty')}</Text>
      ) : null}

      {attachmentsQ.data && attachmentsQ.data.length > 0 ? (
        <View style={styles.attachmentList}>
          {attachmentsQ.data.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void openAttachment(attachment)}
                style={styles.attachmentOpen}
                className="active:opacity-80"
              >
                <View style={styles.attachmentIcon}>
                  <File size={15} color={colors.mutedForeground} />
                </View>
                <View style={styles.attachmentBody}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.fileName}
                  </Text>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {formatAttachmentSize(attachment.fileSize, t)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.attachmentActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('docs.attachmentOpen')}
                  onPress={() => void openAttachment(attachment)}
                  style={styles.attachmentAction}
                  className="active:opacity-80"
                >
                  <ExternalLink size={14} color={colors.mutedForeground} />
                </Pressable>
                {canDelete ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('docs.attachmentDelete')}
                    onPress={() => confirmDeleteAttachment(attachment)}
                    disabled={deleteAttachment.isPending}
                    style={[
                      styles.attachmentAction,
                      deleteAttachment.isPending ? styles.inlineActionDisabled : null,
                    ]}
                    className="active:opacity-80"
                  >
                    <Trash2 size={14} color={colors.destructive} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {attachmentError ? <Text style={styles.errorText}>{attachmentError}</Text> : null}
    </View>
  );
}

function DocumentSubpagesPanel({
  navigation,
  page,
}: {
  navigation: DocumentDetailProps['navigation'];
  page: DocumentPage;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();
  const treeQ = useDocumentTree(page.id);
  const currentNode = treeQ.data ? findDocumentTreeNode(treeQ.data.tree, page.id) : null;
  const childPages = currentNode?.children ?? [];
  const canCreateChild = page.permissions?.canCreate === true || page.permissions?.canEdit === true;

  return (
    <View style={styles.section}>
      <View style={styles.subpagesHeader}>
        <View style={styles.sectionTitle}>
          <BookOpenText size={16} color={colors.foreground} />
          <Text className="text-foreground text-base font-semibold">{t('docs.subpagesTitle')}</Text>
        </View>
        <SemanticBadge label={t('docs.subpageCount', { count: childPages.length })} tone="cyan" />
      </View>

      {treeQ.isLoading ? <Text style={styles.metaText}>{t('common.loading')}</Text> : null}
      {treeQ.isError ? <Text style={styles.errorText}>{t('docs.subpagesLoadFailed')}</Text> : null}
      {!treeQ.isLoading && !treeQ.isError && childPages.length === 0 ? (
        <Text style={styles.metaText}>{t('docs.subpagesEmpty')}</Text>
      ) : null}

      {childPages.length > 0 ? (
        <View style={styles.subpageList}>
          {childPages.map((child) => {
            const updated = child.updatedAt ? relativeTime(child.updatedAt) : null;
            return (
              <Pressable
                key={child.id}
                accessibilityRole="button"
                onPress={() => navigation.push('DocumentDetail', { id: child.id })}
                style={styles.subpageRow}
                className="active:opacity-80"
              >
                <View style={styles.subpageIcon}>
                  <Text style={styles.subpageIconText}>
                    {child.icon || child.title.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.subpageBody}>
                  <Text style={styles.subpageTitle} numberOfLines={2}>
                    {child.title}
                  </Text>
                  <Text style={styles.metaText} numberOfLines={2}>
                    {child.excerpt ||
                      (updated ? t('docs.updated', { date: updated }) : t('docs.subpageNoPreview'))}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {canCreateChild ? (
        <Button
          title={t('docs.createSubpage')}
          icon={Plus}
          variant="secondary"
          onPress={() =>
            navigation.navigate('DocumentEditor', {
              spaceId: page.spaceId,
              parentId: page.id,
              projectId: page.projectId ?? null,
            })
          }
        />
      ) : null}
    </View>
  );
}

function DocumentRevisionsPanel({ page }: { page: DocumentPage }) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();
  const revisionsQ = useDocumentRevisions(page.id);
  const restoreRevision = useRestoreDocumentRevision(page.id);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);
  const canRestore = page.permissions?.canEdit === true;

  const restoreRevisionAsync = async (revision: DocumentRevision) => {
    setRevisionError(null);
    setRevisionNotice(null);
    try {
      await restoreRevision.mutateAsync({ revisionId: revision.id });
      setRevisionNotice(t('docs.revisionRestoredNotice'));
    } catch (err: unknown) {
      setRevisionError(err instanceof Error ? err.message : t('docs.revisionRestoreFailed'));
    }
  };

  const confirmRestoreRevision = (revision: DocumentRevision) => {
    Alert.alert(
      t('docs.revisionRestoreConfirmTitle'),
      t('docs.revisionRestoreConfirmMessage', { revision: revision.revision }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('docs.revisionRestore'),
          onPress: () => {
            void restoreRevisionAsync(revision);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.revisionsHeader}>
        <View style={styles.sectionTitle}>
          <History size={16} color={colors.foreground} />
          <Text className="text-foreground text-base font-semibold">
            {t('docs.revisionsTitle')}
          </Text>
        </View>
        {typeof page.revisionCount === 'number' || revisionsQ.data ? (
          <SemanticBadge
            label={t('docs.revisionsCount', {
              count: page.revisionCount ?? revisionsQ.data?.length ?? 0,
            })}
            tone="violet"
          />
        ) : null}
      </View>

      {revisionsQ.isLoading ? <Text style={styles.metaText}>{t('common.loading')}</Text> : null}
      {revisionsQ.isError ? (
        <Text style={styles.errorText}>{t('docs.revisionsLoadFailed')}</Text>
      ) : null}
      {!revisionsQ.isLoading && !revisionsQ.isError && revisionsQ.data?.length === 0 ? (
        <Text style={styles.metaText}>{t('docs.revisionsEmpty')}</Text>
      ) : null}

      {revisionsQ.data && revisionsQ.data.length > 0 ? (
        <View style={styles.revisionList}>
          {revisionsQ.data.map((revision) => {
            const isCurrentRevision = revision.revision === page.currentRevision;
            const createdAt = revision.createdAt
              ? relativeTime(revision.createdAt)
              : t('docs.revisionUnknownDate');

            return (
              <View key={revision.id} style={styles.revisionRow}>
                <View style={styles.revisionRowHeader}>
                  <Text style={styles.revisionTitle} numberOfLines={2}>
                    {revisionCommitMessage(revision, t)}
                  </Text>
                  <SemanticBadge
                    label={
                      isCurrentRevision
                        ? t('docs.revisionCurrent')
                        : t('docs.revisionNumber', { revision: revision.revision })
                    }
                    tone={isCurrentRevision ? 'emerald' : 'neutral'}
                  />
                </View>
                <Text style={styles.metaText} numberOfLines={1}>
                  {t('docs.revisionMeta', {
                    author: revisionAuthor(revision, t),
                    date: createdAt,
                    id: shortRevisionId(revision.id),
                  })}
                </Text>
                <Text style={styles.revisionPreview} numberOfLines={3}>
                  {revisionPreview(revision, t)}
                </Text>
                {canRestore && !isCurrentRevision ? (
                  <Button
                    title={t('docs.revisionRestore')}
                    icon={RefreshCcw}
                    variant="secondary"
                    loading={restoreRevision.isPending}
                    disabled={restoreRevision.isPending}
                    onPress={() => confirmRestoreRevision(revision)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {revisionNotice ? <Text style={styles.shareNotice}>{revisionNotice}</Text> : null}
      {revisionError ? <Text style={styles.errorText}>{revisionError}</Text> : null}
    </View>
  );
}

export function DocumentDetailScreen({ navigation, route }: DocumentDetailProps) {
  const { t } = useTranslation();
  const { colors, styles } = useDocumentDetailTheme();
  const pageQ = useDocumentPage(route.params.id);
  const page = pageQ.data;

  if (pageQ.isLoading) return <Loading />;
  if (pageQ.isError || !page) {
    return (
      <Screen>
        <ErrorView
          message={pageQ.error instanceof Error ? pageQ.error.message : t('docs.fetchPageFailed')}
          onRetry={() => void pageQ.refetch()}
        />
      </Screen>
    );
  }

  const body = contentText(page);
  const updated = page.updatedAt ? relativeTime(page.updatedAt) : '';

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={pageQ.isRefetching} onRefresh={() => void pageQ.refetch()} />
        }
      >
        <ScreenHeader
          kicker={page.space?.name ?? t('docs.title')}
          title={page.title}
          meta={
            updated ? (
              <SemanticBadge label={t('docs.updated', { date: updated })} tone="cyan" />
            ) : null
          }
        />

        <View style={styles.bodyCard}>
          <View style={styles.docMeta}>
            <SemanticBadge
              label={page.projectId ? t('docs.projectDoc') : t('docs.wiki')}
              tone="cyan"
            />
            {page.permissions?.canEdit === false ? (
              <SemanticBadge label={t('docs.readOnly')} tone="neutral" />
            ) : null}
            {typeof page.revisionCount === 'number' ? (
              <SemanticBadge label={String(page.revisionCount)} tone="violet" />
            ) : null}
          </View>
          {page.permissions?.canEdit === true ? (
            <Button
              title={t('docs.edit')}
              icon={Pencil}
              variant="secondary"
              onPress={() => navigation.navigate('DocumentEditor', { id: page.id })}
            />
          ) : null}
          {body ? (
            <DocumentContent page={page} />
          ) : (
            <EmptyState
              icon={BookOpenText}
              title={t('docs.contentEmpty')}
              description={t('docs.contentEmptyDesc')}
            />
          )}
        </View>

        <DocumentSharePanel page={page} />

        <DocumentAttachmentsPanel
          pageId={page.id}
          canEdit={page.permissions?.canEdit === true}
          canDelete={page.permissions?.canDelete === true || page.permissions?.canEdit === true}
        />

        <DocumentSubpagesPanel page={page} navigation={navigation} />

        <DocumentRevisionsPanel page={page} />

        {page.relatedIssues && page.relatedIssues.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <ListTodo size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">
                {t('docs.relatedIssues')}
              </Text>
            </View>
            <View style={styles.rows}>
              {page.relatedIssues.map((issue) => (
                <Pressable
                  key={issue.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
                  style={styles.linkRow}
                  className="active:opacity-80"
                >
                  <FileText size={16} color={colors.accentBlue} />
                  <View className="min-w-0 flex-1 gap-1">
                    {issue.key ? <SemanticBadge label={issue.key} tone="blue" /> : null}
                    <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
                      {issue.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {page.backlinks && page.backlinks.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Link2 size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('docs.backlinks')}</Text>
            </View>
            <View style={styles.rows}>
              {page.backlinks.map((link) => (
                <Pressable
                  key={link.id}
                  accessibilityRole="button"
                  onPress={() => navigation.push('DocumentDetail', { id: link.id })}
                  style={styles.linkRow}
                  className="active:opacity-80"
                >
                  <Link2 size={16} color={colors.accentViolet} />
                  <Text className="text-foreground flex-1 text-sm font-semibold" numberOfLines={2}>
                    {link.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createDocumentDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 16,
      paddingBottom: 20,
    },
    bodyCard: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 14,
    },
    docMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    section: {
      gap: 10,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    shareHeader: {
      minHeight: 28,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    shareActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    shareOptions: {
      gap: 8,
    },
    shareOptionsTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    shareRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    shareRowDisabled: {
      opacity: 0.55,
    },
    shareRowIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    shareRowBody: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    shareRowTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    shareRowDescription: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    shareNotice: {
      color: colors.success,
      fontSize: 12,
      lineHeight: 16,
    },
    attachmentsHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    attachmentsHeaderText: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    subpagesHeader: {
      minHeight: 28,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    subpageList: {
      gap: 8,
    },
    subpageRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    subpageIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    subpageIconText: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 20,
    },
    subpageBody: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    subpageTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    revisionsHeader: {
      minHeight: 28,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    revisionList: {
      gap: 8,
    },
    revisionRow: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    revisionRowHeader: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    revisionTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    revisionPreview: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 18,
    },
    attachmentList: {
      gap: 8,
    },
    attachmentRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    attachmentOpen: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    attachmentIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    attachmentBody: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    attachmentName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    attachmentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    attachmentAction: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineActionDisabled: {
      opacity: 0.45,
    },
    metaText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 16,
    },
    rows: {
      gap: 8,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
  });
}
