import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import { useMemo } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronRight, FolderKanban, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useProjects } from '@/hooks/queries';
import type { Project } from '@/api/types';
import type { AppStackParamList } from '@/navigation/types';

type ProjectsScreenStyles = ReturnType<typeof createProjectsScreenStyles>;

function useProjectsScreenTheme(): {
  colors: ThemeColors;
  styles: ProjectsScreenStyles;
  tileColors: string[];
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectsScreenStyles(colors), [colors]);
  const tileColors = useMemo(() => createTileColors(colors), [colors]);
  return { colors, styles, tileColors };
}

function createTileColors(colors: ThemeColors): string[] {
  return [
    colors.accentBlue,
    colors.accentViolet,
    colors.accentCyan,
    colors.accentEmerald,
    colors.accentAmber,
    colors.accentRose,
  ];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
}

function projectAccent(project: Project, tileColors: string[]): string {
  return project.color ?? tileColors[hashString(project.id) % tileColors.length] ?? tileColors[0]!;
}

function projectInitials(project: Project): string {
  const source = project.name.trim() || project.key;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function ProjectRow({ project }: { project: Project }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { t } = useTranslation();
  const { colors, styles, tileColors } = useProjectsScreenTheme();
  const accent = projectAccent(project, tileColors);
  const issueCount = project.issueCount ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('ProjectDetail', { id: project.id })}
      className="active:opacity-80"
      style={[styles.projectCard, { borderTopColor: accent }]}
    >
      <View style={styles.projectHeader}>
        <View
          style={[
            styles.projectTile,
            {
              backgroundColor: alpha(accent, '1F'),
              borderColor: alpha(accent, '42'),
            },
          ]}
        >
          <Text style={[styles.projectTileText, { color: accent }]}>
            {projectInitials(project)}
          </Text>
        </View>

        <View style={styles.projectTitleBlock}>
          <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.projectKey} numberOfLines={1}>
            {project.key}
          </Text>
        </View>

        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>

      {project.description ? (
        <Text
          className="text-muted-foreground text-sm"
          numberOfLines={2}
          style={styles.description}
        >
          {project.description}
        </Text>
      ) : null}

      <View style={styles.projectFooter}>
        <View style={styles.footerMetric}>
          <Text style={styles.footerMetricValue}>{issueCount}</Text>
          <Text style={styles.footerMetricLabel}>{t('projects.issues')}</Text>
        </View>
        <SemanticBadge label={project.key} tone="blue" />
      </View>
    </Pressable>
  );
}

export function ProjectsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { styles } = useProjectsScreenTheme();
  const { data, isLoading, isError, error, refetch, isRefetching } = useProjects();
  const projects = data ?? [];

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Screen>
        <ErrorView
          message={error instanceof Error ? error.message : t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<Project> = ({ item }) => <ProjectRow project={item} />;

  return (
    <Screen>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
        meta={<SemanticBadge label={t('projects.count', { count: projects.length })} tone="blue" />}
      />
      <View style={styles.headerActions}>
        <Button
          title={t('projects.new')}
          icon={Plus}
          onPress={() => navigation.navigate('NewProject')}
        />
      </View>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={FolderKanban}
            title={t('projects.empty')}
            description={t('projects.emptyDesc')}
          />
        }
      />
    </Screen>
  );
}

function createProjectsScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerActions: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    projectCard: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 16,
    },
    projectHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    projectTile: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
    },
    projectTileText: {
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    projectTitleBlock: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    projectKey: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 16,
      textTransform: 'uppercase',
    },
    description: {
      lineHeight: 20,
    },
    projectFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 12,
    },
    footerMetric: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    footerMetricValue: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    footerMetricLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
  });
}
