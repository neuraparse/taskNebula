import { useEffect, useMemo, useRef, useState } from 'react';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CheckCircle2,
  FileSpreadsheet,
  Github,
  GitPullRequest,
  Play,
  RefreshCw,
  UploadCloud,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { ImportJobStatus, ImportPreviewRecord, Organization, Project } from '@/api/types';
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
  useImportJob,
  useImportPreview,
  useOrganizations,
  useProjects,
  useRunImport,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type SourceKey = 'csv' | 'plane' | 'linear' | 'jira' | 'github';
type ImportSettingsProps = NativeStackScreenProps<AppStackParamList, 'ImportSettings'>;
type ImportSettingsStyles = ReturnType<typeof createImportSettingsStyles>;

function useImportSettingsTheme(): { colors: ThemeColors; styles: ImportSettingsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createImportSettingsStyles(colors), [colors]);
  return { colors, styles };
}

const SOURCES: SourceKey[] = ['csv', 'plane', 'linear', 'jira', 'github'];
const CSV_SOURCES: SourceKey[] = ['csv', 'plane'];
const MAPPABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'labels',
  'assigneeEmail',
  'parentKey',
  'createdAt',
  'key',
] as const;

function apiSourceFor(source: SourceKey): 'csv' | 'linear' | 'jira' | 'github' {
  return source === 'plane' ? 'csv' : source;
}

function sourceIcon(source: SourceKey) {
  if (source === 'github') return Github;
  if (source === 'linear') return GitPullRequest;
  return FileSpreadsheet;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells.filter(Boolean);
}

function csvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return splitCsvLine(firstLine);
}

function organizationLabel(organization: Organization): string {
  return organization.name || organization.id;
}

function projectLabel(project: Project): string {
  return `${project.key} - ${project.name}`;
}

function previewMeta(record: ImportPreviewRecord, fallback: string): string {
  return [record.key, record.status ?? fallback, record.priority ?? fallback].join(' · ');
}

function importErrorLabel(key: string, message: string): string {
  return `${key} - ${message}`;
}

function fieldLabelKey(field: (typeof MAPPABLE_FIELDS)[number]): string {
  return `importWizard.field.${field}`;
}

function progressPercent(job: ImportJobStatus | null | undefined): number {
  if (!job || job.total <= 0) return 0;
  return Math.min(100, Math.round((job.processed / job.total) * 100));
}

function isFinalJobStatus(job: ImportJobStatus | null | undefined): boolean {
  return job?.status === 'completed' || job?.status === 'failed';
}

function ChoicePill<T extends string>({
  disabled,
  label,
  selected,
  value,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  selected: boolean;
  value: T;
  onPress: (value: T) => void;
}) {
  const { styles } = useImportSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(value)}
      style={[
        styles.choicePill,
        selected ? styles.choicePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SourceCard({
  source,
  selected,
  onPress,
}: {
  source: SourceKey;
  selected: boolean;
  onPress: (source: SourceKey) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useImportSettingsTheme();
  const Icon = sourceIcon(source);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(source)}
      style={[styles.sourceCard, selected ? styles.sourceCardActive : null]}
      className="active:opacity-80"
    >
      <View style={styles.sourceHeader}>
        <IconTile icon={Icon} tone={source === 'github' ? 'indigo' : 'cyan'} />
        <View className="min-w-0 flex-1 gap-1">
          <Text style={styles.cardTitle}>{t(`importWizard.source.${source}.label`)}</Text>
          <Text style={styles.cardDescription}>
            {t(`importWizard.source.${source}.description`)}
          </Text>
        </View>
      </View>
      {!CSV_SOURCES.includes(source) ? (
        <SemanticBadge label={t('importWizard.apiSource')} tone="violet" />
      ) : null}
    </Pressable>
  );
}

function PreviewRow({ record }: { record: ImportPreviewRecord }) {
  const { t } = useTranslation();
  const { styles } = useImportSettingsTheme();
  return (
    <View style={styles.previewRow}>
      <View className="min-w-0 flex-1 gap-1">
        <Text style={styles.previewTitle} numberOfLines={1}>
          {record.title}
        </Text>
        <Text style={styles.previewMeta} numberOfLines={1}>
          {previewMeta(record, t('common.none'))}
        </Text>
      </View>
      {record.assigneeEmail ? <SemanticBadge label={record.assigneeEmail} tone="neutral" /> : null}
    </View>
  );
}

export function ImportSettingsScreen({ route }: ImportSettingsProps) {
  const { t } = useTranslation();
  const { colors, styles } = useImportSettingsTheme();
  const routeSource = route.params?.source ?? null;
  const routeProjectId = route.params?.projectId?.trim() || null;
  const organizationsQ = useOrganizations();
  const projectsQ = useProjects();
  const previewImport = useImportPreview();
  const runImport = useRunImport();

  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const [source, setSource] = useState<SourceKey>(routeSource ?? 'csv');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(routeProjectId);
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [linearKey, setLinearKey] = useState('');
  const [linearTeam, setLinearTeam] = useState('');
  const [jiraSite, setJiraSite] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appliedRouteSourceRef = useRef<SourceKey | null>(routeSource);
  const appliedRouteProjectRef = useRef<string | null>(null);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.organizationId === organizationId),
    [organizationId, projects],
  );
  const jobQ = useImportJob(jobId, !!jobId);
  const job = jobQ.data;
  const refetchJob = jobQ.refetch;
  const activeJob = Boolean(jobId && !isFinalJobStatus(job));
  const isBusy = previewImport.isPending || runImport.isPending;
  const selectedSource = source;
  const preview = previewImport.data;

  useEffect(() => {
    if (!routeSource) {
      appliedRouteSourceRef.current = null;
      return;
    }
    if (appliedRouteSourceRef.current === routeSource) return;
    appliedRouteSourceRef.current = routeSource;
    setSource(routeSource);
  }, [routeSource]);

  useEffect(() => {
    if (
      organizationId &&
      organizations.some((organization) => organization.id === organizationId)
    ) {
      return;
    }
    setOrganizationId(organizations[0]?.id ?? null);
  }, [organizationId, organizations]);

  useEffect(() => {
    if (projectId && activeProjects.some((project) => project.id === projectId)) return;
    setProjectId(activeProjects[0]?.id ?? null);
  }, [activeProjects, projectId]);

  useEffect(() => {
    setProjectId(null);
    setNotice(null);
    setError(null);
  }, [organizationId]);

  useEffect(() => {
    if (!routeProjectId) {
      appliedRouteProjectRef.current = null;
      return;
    }
    if (appliedRouteProjectRef.current === routeProjectId) return;
    const requestedProject = projects.find((project) => project.id === routeProjectId);
    if (!requestedProject) return;
    if (organizationId !== requestedProject.organizationId) {
      setOrganizationId(requestedProject.organizationId);
      setProjectId(routeProjectId);
      return;
    }
    appliedRouteProjectRef.current = routeProjectId;
    setProjectId(routeProjectId);
  }, [organizationId, projects, routeProjectId]);

  useEffect(() => {
    if (!jobId || !activeJob) return undefined;
    const timer = setTimeout(() => {
      void refetchJob();
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeJob, jobId, job?.processed, job?.status, refetchJob]);

  const setCsv = (value: string) => {
    setCsvText(value);
    const nextHeaders = csvHeaders(value);
    setHeaders(nextHeaders);
    setColumns((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, header]) => nextHeaders.includes(header)),
      ),
    );
  };

  const pickCsvFile = async () => {
    setError(null);
    setNotice(null);
    try {
      const [file] = await pick({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
      });
      if (file.error) {
        setError(t('importWizard.fileReadFailed'));
        return;
      }
      const response = await fetch(file.uri);
      const text = await response.text();
      setCsv(text);
      setNotice(t('importWizard.fileLoaded', { name: file.name ?? t('common.none') }));
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      setError(err instanceof Error ? err.message : t('importWizard.fileReadFailed'));
    }
  };

  const buildPreviewBody = (): Record<string, unknown> => {
    const workspaceId = organizationId ?? '';
    if (selectedSource === 'csv' || selectedSource === 'plane') {
      return { workspaceId, csvText, columns };
    }
    if (selectedSource === 'linear') {
      return {
        workspaceId,
        apiKey: linearKey.trim(),
        teamKey: linearTeam.trim() || undefined,
      };
    }
    if (selectedSource === 'jira') {
      return {
        workspaceId,
        site: jiraSite.trim(),
        email: jiraEmail.trim().toLowerCase(),
        apiToken: jiraToken.trim(),
      };
    }
    return {
      workspaceId,
      accessToken: githubToken.trim(),
      owner: githubOwner.trim(),
      repo: githubRepo.trim(),
    };
  };

  const validatePreview = (): string | null => {
    if (!organizationId) return t('importWizard.errorWorkspaceRequired');
    if (selectedSource === 'csv' || selectedSource === 'plane') {
      if (!csvText.trim()) return t('importWizard.errorCsvRequired');
      return null;
    }
    if (selectedSource === 'linear' && !linearKey.trim())
      return t('importWizard.errorLinearRequired');
    if (selectedSource === 'jira' && (!jiraSite.trim() || !jiraEmail.trim() || !jiraToken.trim())) {
      return t('importWizard.errorJiraRequired');
    }
    if (
      selectedSource === 'github' &&
      (!githubToken.trim() || !githubOwner.trim() || !githubRepo.trim())
    ) {
      return t('importWizard.errorGithubRequired');
    }
    return null;
  };

  const runPreview = async () => {
    const validation = validatePreview();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setNotice(null);
    setJobId(null);
    try {
      const result = await previewImport.mutateAsync({
        source: apiSourceFor(selectedSource),
        input: buildPreviewBody(),
      });
      setColumns((current) => ({ ...result.suggestedMapping, ...current }));
      if (result.sample.length === 0) {
        setError(t('importWizard.noPreviewRows'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importWizard.errorPreview'));
    }
  };

  const startImport = async () => {
    if (!organizationId || !projectId) {
      setError(t('importWizard.errorProjectRequired'));
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const result = await runImport.mutateAsync({
        source: apiSourceFor(selectedSource),
        input: {
          workspaceId: organizationId,
          projectId,
          mapping: {
            columns,
            config: buildPreviewBody(),
          },
          ...(selectedSource === 'csv' || selectedSource === 'plane' ? { csvText } : {}),
        },
      });
      setJobId(result.jobId);
      setNotice(t('importWizard.importStarted'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importWizard.errorRun'));
    }
  };

  if (organizationsQ.isLoading || projectsQ.isLoading) {
    return <Loading label={t('importWizard.loading')} />;
  }

  if (organizationsQ.isError || projectsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('importWizard.kicker')}
          title={t('importWizard.title')}
          subtitle={t('importWizard.subtitle')}
        />
        <ErrorView
          message={t('importWizard.errorLoad')}
          onRetry={() => {
            void organizationsQ.refetch();
            void projectsQ.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        kicker={t('importWizard.kicker')}
        title={t('importWizard.title')}
        subtitle={t('importWizard.subtitle')}
        meta={
          <SemanticBadge
            label={t('importWizard.sourceCount', { count: SOURCES.length })}
            tone="cyan"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {organizations.length === 0 || projects.length === 0 ? (
          <EmptyState
            icon={UploadCloud}
            title={t('importWizard.emptyTitle')}
            description={t('importWizard.emptyDesc')}
          />
        ) : (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.sectionTitle}>
                <IconTile icon={UploadCloud} tone="cyan" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('importWizard.sourceTitle')}</Text>
                  <Text style={styles.panelSubtitle}>{t('importWizard.sourceSubtitle')}</Text>
                </View>
              </View>
              <View style={styles.sourceGrid}>
                {SOURCES.map((item) => (
                  <SourceCard
                    key={item}
                    source={item}
                    selected={selectedSource === item}
                    onPress={(next) => {
                      setSource(next);
                      previewImport.reset();
                      setJobId(null);
                      setError(null);
                      setNotice(null);
                    }}
                  />
                ))}
              </View>
            </SurfaceRow>

            <SurfaceRow className="gap-3">
              <View style={styles.sectionTitle}>
                <IconTile icon={sourceIcon(selectedSource)} tone="indigo" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>
                    {t('importWizard.importingFrom', {
                      source: t(`importWizard.source.${selectedSource}.label`),
                    })}
                  </Text>
                  <Text style={styles.panelSubtitle}>
                    {t(`importWizard.source.${selectedSource}.description`)}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{t('importWizard.workspace')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.choiceWrap}
                >
                  {organizations.map((organization) => (
                    <ChoicePill
                      key={organization.id}
                      label={organizationLabel(organization)}
                      value={organization.id}
                      selected={organizationId === organization.id}
                      disabled={isBusy || activeJob}
                      onPress={setOrganizationId}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{t('importWizard.targetProject')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.choiceWrap}
                >
                  {activeProjects.map((project) => (
                    <ChoicePill
                      key={project.id}
                      label={projectLabel(project)}
                      value={project.id}
                      selected={projectId === project.id}
                      disabled={isBusy || activeJob}
                      onPress={setProjectId}
                    />
                  ))}
                </ScrollView>
              </View>

              {selectedSource === 'csv' || selectedSource === 'plane' ? (
                <View style={styles.sectionBlock}>
                  <Button
                    title={t('importWizard.pickCsv')}
                    icon={FileSpreadsheet}
                    variant="secondary"
                    disabled={isBusy || activeJob}
                    onPress={() => void pickCsvFile()}
                  />
                  <TextInput
                    value={csvText}
                    editable={!isBusy && !activeJob}
                    multiline
                    placeholder={t('importWizard.csvPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    onChangeText={setCsv}
                    style={styles.csvInput}
                  />
                </View>
              ) : null}

              {selectedSource === 'linear' ? (
                <View style={styles.sectionBlock}>
                  <TextField
                    label={t('importWizard.linearKey')}
                    value={linearKey}
                    secureTextEntry
                    editable={!isBusy && !activeJob}
                    onChangeText={setLinearKey}
                  />
                  <TextField
                    label={t('importWizard.linearTeam')}
                    placeholder={t('importWizard.linearTeamPlaceholder')}
                    value={linearTeam}
                    autoCapitalize="characters"
                    editable={!isBusy && !activeJob}
                    onChangeText={setLinearTeam}
                  />
                </View>
              ) : null}

              {selectedSource === 'jira' ? (
                <View style={styles.sectionBlock}>
                  <TextField
                    label={t('importWizard.jiraSite')}
                    placeholder={t('importWizard.jiraSitePlaceholder')}
                    value={jiraSite}
                    autoCapitalize="none"
                    editable={!isBusy && !activeJob}
                    onChangeText={setJiraSite}
                  />
                  <TextField
                    label={t('importWizard.jiraEmail')}
                    value={jiraEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isBusy && !activeJob}
                    onChangeText={setJiraEmail}
                  />
                  <TextField
                    label={t('importWizard.jiraToken')}
                    value={jiraToken}
                    secureTextEntry
                    editable={!isBusy && !activeJob}
                    onChangeText={setJiraToken}
                  />
                </View>
              ) : null}

              {selectedSource === 'github' ? (
                <View style={styles.sectionBlock}>
                  <TextField
                    label={t('importWizard.githubToken')}
                    value={githubToken}
                    secureTextEntry
                    editable={!isBusy && !activeJob}
                    onChangeText={setGithubToken}
                  />
                  <TextField
                    label={t('importWizard.githubOwner')}
                    value={githubOwner}
                    autoCapitalize="none"
                    editable={!isBusy && !activeJob}
                    onChangeText={setGithubOwner}
                  />
                  <TextField
                    label={t('importWizard.githubRepo')}
                    value={githubRepo}
                    autoCapitalize="none"
                    editable={!isBusy && !activeJob}
                    onChangeText={setGithubRepo}
                  />
                </View>
              ) : null}

              <Button
                title={t('importWizard.preview')}
                icon={RefreshCw}
                loading={previewImport.isPending}
                disabled={isBusy || activeJob}
                onPress={() => void runPreview()}
              />
            </SurfaceRow>

            {(selectedSource === 'csv' || selectedSource === 'plane') && headers.length > 0 ? (
              <SurfaceRow className="gap-3">
                <Text style={styles.panelTitle}>{t('importWizard.columnMapping')}</Text>
                {MAPPABLE_FIELDS.map((field) => (
                  <View key={field} style={styles.mappingRow}>
                    <Text style={styles.sectionLabel}>{t(fieldLabelKey(field))}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.choiceWrap}
                    >
                      <ChoicePill
                        label={t('importWizard.none')}
                        value=""
                        selected={!columns[field]}
                        disabled={isBusy || activeJob}
                        onPress={(value) =>
                          setColumns((current) => ({ ...current, [field]: value }))
                        }
                      />
                      {headers.map((header) => (
                        <ChoicePill
                          key={`${field}-${header}`}
                          label={header}
                          value={header}
                          selected={columns[field] === header}
                          disabled={isBusy || activeJob}
                          onPress={(value) =>
                            setColumns((current) => ({ ...current, [field]: value }))
                          }
                        />
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </SurfaceRow>
            ) : null}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {preview && preview.sample.length > 0 ? (
              <SurfaceRow className="gap-3">
                <View style={styles.previewHeader}>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>
                      {t('importWizard.previewCount', {
                        shown: preview.sample.length,
                        total: preview.total,
                      })}
                    </Text>
                    <Text style={styles.panelSubtitle}>{t('importWizard.previewSubtitle')}</Text>
                  </View>
                  <Button
                    title={t('importWizard.runImport')}
                    icon={Play}
                    loading={runImport.isPending}
                    disabled={isBusy || activeJob || !projectId}
                    onPress={() => void startImport()}
                  />
                </View>
                <View style={styles.previewList}>
                  {preview.sample.map((record) => (
                    <PreviewRow key={record.key} record={record} />
                  ))}
                </View>
              </SurfaceRow>
            ) : null}

            {jobId ? (
              <SurfaceRow className="gap-3">
                <View style={styles.previewHeader}>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>
                      {job?.status === 'completed'
                        ? t('importWizard.complete')
                        : job?.status === 'failed'
                          ? t('importWizard.failed')
                          : t('importWizard.importing')}
                    </Text>
                    <Text style={styles.panelSubtitle}>
                      {t('importWizard.progressCount', {
                        processed: job?.processed ?? 0,
                        total: job?.total ?? 0,
                      })}
                    </Text>
                  </View>
                  <SemanticBadge
                    label={job?.status ?? t('importWizard.pending')}
                    tone={
                      job?.status === 'completed'
                        ? 'emerald'
                        : job?.status === 'failed'
                          ? 'rose'
                          : 'amber'
                    }
                  />
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent(job)}%` }]} />
                </View>
                {jobQ.isFetching && !job ? (
                  <Text style={styles.panelSubtitle}>{t('importWizard.loadingJob')}</Text>
                ) : null}
                {job?.errors.length ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxTitle}>
                      {t('importWizard.recordsFailed', { count: job.errors.length })}
                    </Text>
                    {job.errors.slice(0, 5).map((item, index) => (
                      <Text key={`${item.key ?? 'row'}-${index}`} style={styles.errorBoxText}>
                        {importErrorLabel(item.key ?? t('common.none'), item.message)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {job?.status === 'completed' ? (
                  <View style={styles.doneRow}>
                    <CheckCircle2 size={16} color={colors.accentEmerald} />
                    <Text style={styles.noticeText}>{t('importWizard.completedNotice')}</Text>
                  </View>
                ) : null}
              </SurfaceRow>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createImportSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    sectionTitle: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionBlock: {
      gap: 10,
    },
    sectionLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    panelTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    panelSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    sourceGrid: {
      gap: 10,
    },
    sourceCard: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    sourceCardActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    sourceHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    cardTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    cardDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    choiceWrap: {
      flexDirection: 'row',
      gap: 8,
    },
    choicePill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    choicePillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choiceText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    choiceTextActive: {
      color: colors.primaryForeground,
    },
    csvInput: {
      minHeight: 160,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 12,
      textAlignVertical: 'top',
    },
    mappingRow: {
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    previewHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    previewList: {
      gap: 8,
    },
    previewRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 10,
    },
    previewTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    previewMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    progressTrack: {
      height: 8,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    progressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    errorBox: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.destructive,
      borderRadius: 4,
      backgroundColor: `${colors.destructive}10`,
      padding: 10,
    },
    errorBoxTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    errorBoxText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 16,
    },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    noticeText: {
      color: colors.accentEmerald,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
