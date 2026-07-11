import { Pressable, StyleSheet, Text, View } from '@/components/native';
import { Boxes, Milestone, User, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Label, ProjectComponent, ProjectMember, ProjectVersion } from '@/api/types';
import { useThemeColors } from '@/design/theme-context';
import { initials } from '@/lib/format';

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function versionStatusLabel(version: ProjectVersion, t: ReturnType<typeof useTranslation>['t']) {
  if (version.status === 'released') return t('settings.versions.status_released');
  if (version.status === 'archived') return t('settings.versions.status_archived');
  return t('settings.versions.status_unreleased');
}

export function AssigneeOption({
  member,
  selected,
  disabled,
  onPress,
}: {
  member: ProjectMember | null;
  selected: boolean;
  disabled?: boolean;
  onPress: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const displayName = member?.user.name ?? member?.user.email ?? t('issues.unassigned');
  const userId = member?.userId ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(userId)}
      style={[
        styles.assigneeOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View
        style={[
          styles.assigneeAvatar,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {member ? (
          <Text style={[styles.assigneeInitials, { color: colors.foreground }]}>
            {initials(member.user.name, member.user.email)}
          </Text>
        ) : (
          <User size={16} color={colors.mutedForeground} />
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {displayName}
        </Text>
        {member?.role ? (
          <Text style={[styles.assigneeRole, { color: colors.mutedForeground }]} numberOfLines={1}>
            {member.role}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function LabelOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: Label;
  selected: boolean;
  disabled?: boolean;
  onPress: (name: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(label.name)}
      style={[
        styles.labelOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View
        style={[styles.labelSwatch, { backgroundColor: label.color ?? colors.mutedForeground }]}
      />
      <Text
        style={[styles.labelOptionText, { color: selected ? colors.primary : colors.foreground }]}
        numberOfLines={1}
      >
        {label.name}
      </Text>
    </Pressable>
  );
}

export function SelectedLabelChip({
  name,
  disabled,
  onRemove,
}: {
  name: string;
  disabled?: boolean;
  onRemove: (name: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onRemove(name)}
      style={[
        styles.selectedLabel,
        { backgroundColor: colors.primary },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.selectedLabelText, { color: colors.primaryForeground }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <X size={13} color={colors.primaryForeground} />
    </Pressable>
  );
}

export function ComponentOption({
  component,
  selected,
  disabled,
  onPress,
}: {
  component: ProjectComponent;
  selected: boolean;
  disabled?: boolean;
  onPress: (componentId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(component.id)}
      style={[
        styles.componentOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View style={[styles.componentIcon, { backgroundColor: colors.muted }]}>
        <Boxes size={15} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {component.name}
        </Text>
        <Text style={[styles.componentMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {component.archived
            ? t('settings.components.col_archived')
            : t('issues.count', { count: component.issueCount ?? 0 })}
        </Text>
      </View>
    </Pressable>
  );
}

export function SelectedComponentChip({
  component,
  disabled,
  onRemove,
}: {
  component: ProjectComponent;
  disabled?: boolean;
  onRemove: (componentId: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onRemove(component.id)}
      style={[
        styles.selectedLabel,
        { backgroundColor: colors.primary },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.selectedLabelText, { color: colors.primaryForeground }]}
        numberOfLines={1}
      >
        {component.name}
      </Text>
      <X size={13} color={colors.primaryForeground} />
    </Pressable>
  );
}

export function VersionOption({
  version,
  selected,
  disabled,
  onPress,
}: {
  version: ProjectVersion;
  selected: boolean;
  disabled?: boolean;
  onPress: (versionId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const meta =
    version.issueCount !== undefined
      ? t('settings.versions.progress', {
          done: version.doneIssueCount ?? 0,
          total: version.issueCount,
        })
      : versionStatusLabel(version, t);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(version.id)}
      style={[
        styles.componentOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View style={[styles.componentIcon, { backgroundColor: colors.muted }]}>
        <Milestone size={15} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {version.name}
        </Text>
        <Text style={[styles.componentMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

export function SelectedVersionChip({
  version,
  disabled,
  onRemove,
}: {
  version: ProjectVersion;
  disabled?: boolean;
  onRemove: (versionId: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onRemove(version.id)}
      style={[
        styles.selectedLabel,
        { backgroundColor: colors.primary },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.selectedLabelText, { color: colors.primaryForeground }]}
        numberOfLines={1}
      >
        {version.name}
      </Text>
      <X size={13} color={colors.primaryForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.55,
  },
  assigneeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 10,
  },
  assigneeAvatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  assigneeInitials: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  assigneeRole: {
    fontSize: 11,
    lineHeight: 16,
  },
  selectedLabel: {
    maxWidth: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedLabelText: {
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  labelOption: {
    maxWidth: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  labelSwatch: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  labelOptionText: {
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  componentOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  componentIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  componentMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
});
