import { useMemo } from 'react';
import { Linking } from 'react-native';
import { ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExternalLink, FileText, Globe2, LockKeyhole, Paperclip } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { PublicDocumentAttachment, PublicDocumentPage } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
} from '@/components/ui';
import { DocumentRichContent } from '@/components/document-rich-content';
import { useThemeColors } from '@/design/theme-context';
import { usePublicDocumentPage } from '@/hooks/queries';
import { documentContentToPlainText } from '@/lib/document-content';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';
import { useSession } from '@/stores/session';

type PublicDocumentRouteProps = NativeStackScreenProps<AppStackParamList, 'PublicDocument'>;
type PublicDocumentScreenProps =
  | PublicDocumentRouteProps
  | {
      token: string;
      onClose?: () => void;
    };

function getToken(props: PublicDocumentScreenProps): string {
  return 'route' in props ? props.route.params.token : props.token;
}

function resolveServerUrl(
  baseUrl: string | null,
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null;
  try {
    const parsed = new URL(pathOrUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Relative path.
  }
  if (!baseUrl) return null;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${path}`;
}

function documentText(page: PublicDocumentPage): string {
  return documentContentToPlainText(page.contentJson) || page.excerpt?.trim() || '';
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

function AttachmentRow({
  attachment,
  baseUrl,
}: {
  attachment: PublicDocumentAttachment;
  baseUrl: string | null;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const url = resolveServerUrl(baseUrl, attachment.publicUrl);
  const size = formatAttachmentSize(attachment.fileSize, t);

  return (
    <View
      style={[
        styles.attachmentRow,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View
        style={[
          styles.attachmentIcon,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <FileText size={17} color={colors.foreground} />
      </View>
      <View style={styles.attachmentBody}>
        <Text style={[styles.attachmentName, { color: colors.foreground }]} numberOfLines={2}>
          {attachment.fileName}
        </Text>
        <Text style={[styles.attachmentMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {t('publicShare.attachmentMeta', { mimeType: attachment.mimeType, size })}
        </Text>
      </View>
      <Button
        title={t('publicShare.openAttachment')}
        variant="secondary"
        icon={ExternalLink}
        disabled={!url}
        onPress={() => {
          if (url) void Linking.openURL(url);
        }}
      />
    </View>
  );
}

export function PublicDocumentScreen(props: PublicDocumentScreenProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const token = getToken(props);
  const onClose = 'route' in props ? undefined : props.onClose;
  const serverUrl = useSession((s) => s.serverUrl);
  const pageQ = usePublicDocumentPage(token);
  const page = pageQ.data;
  const shareUrl = resolveServerUrl(serverUrl, `/share/${encodeURIComponent(token)}`);
  const body = useMemo(() => (page ? documentText(page) : ''), [page]);

  if (pageQ.isLoading) return <Loading label={t('publicShare.loading')} />;
  if (pageQ.isError || !page) {
    return (
      <Screen>
        <ErrorView
          message={pageQ.error instanceof Error ? pageQ.error.message : t('publicShare.loadFailed')}
          onRetry={() => void pageQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={t('publicShare.kicker')}
          title={page.title}
          subtitle={page.excerpt ?? t('publicShare.subtitle')}
          meta={
            <SemanticBadge
              label={
                page.allowSearchIndexing
                  ? t('publicShare.searchVisible')
                  : t('publicShare.searchHidden')
              }
              tone={page.allowSearchIndexing ? 'emerald' : 'neutral'}
            />
          }
        />

        <View style={styles.metaRow}>
          <SemanticBadge label={t('publicShare.public')} tone="cyan" />
          <SemanticBadge
            label={t('docs.updated', { date: relativeTime(page.updatedAt) })}
            tone="neutral"
          />
          {page.publishedAt ? (
            <SemanticBadge
              label={t('publicShare.published', { date: relativeTime(page.publishedAt) })}
              tone="neutral"
            />
          ) : null}
        </View>

        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {page.allowSearchIndexing ? (
            <Globe2 size={16} color={colors.primary} />
          ) : (
            <LockKeyhole size={16} color={colors.mutedForeground} />
          )}
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            {page.allowSearchIndexing
              ? t('publicShare.publicNotice')
              : t('publicShare.hiddenNotice')}
          </Text>
        </View>

        {body ? (
          <View
            style={[styles.bodyCard, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <DocumentRichContent
              baseUrl={serverUrl}
              contentJson={page.contentJson}
              fallbackText={body}
            />
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={FileText}
              title={t('publicShare.emptyTitle')}
              description={t('publicShare.emptyDesc')}
            />
          </View>
        )}

        {page.attachments.length > 0 ? (
          <View
            style={[
              styles.attachmentsCard,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View style={styles.attachmentsHeader}>
              <Paperclip size={17} color={colors.foreground} />
              <Text style={[styles.attachmentsTitle, { color: colors.foreground }]}>
                {t('publicShare.attachments', { count: page.attachments.length })}
              </Text>
            </View>
            {page.attachments.map((attachment) => (
              <AttachmentRow key={attachment.id} attachment={attachment} baseUrl={serverUrl} />
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Button
            title={t('publicShare.openInBrowser')}
            icon={ExternalLink}
            variant="secondary"
            disabled={!shareUrl}
            onPress={() => {
              if (shareUrl) void Linking.openURL(shareUrl);
            }}
          />
          {onClose ? (
            <Button title={t('onboarding.signIn')} variant="ghost" onPress={onClose} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  bodyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
    padding: 14,
  },
  emptyWrap: {
    marginHorizontal: 16,
  },
  attachmentsCard: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
    padding: 12,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  attachmentRow: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 10,
  },
  attachmentIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  attachmentBody: {
    gap: 3,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  attachmentMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    gap: 10,
    paddingHorizontal: 16,
  },
});
