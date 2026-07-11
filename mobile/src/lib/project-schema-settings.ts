import { useCallback, useEffect, useMemo, useState } from 'react';

import { mmkv } from './storage';

export type WorkItemIcon =
  | 'book'
  | 'bug'
  | 'pin'
  | 'sparkles'
  | 'target'
  | 'flame'
  | 'lightbulb'
  | 'rocket';

export type WorkItemCustomPropertyType =
  | 'text'
  | 'number'
  | 'dropdown'
  | 'date'
  | 'member'
  | 'url'
  | 'boolean';

export interface WorkItemCustomProperty {
  id: string;
  name: string;
  type: WorkItemCustomPropertyType;
  required: boolean;
  options?: string[];
}

export interface WorkItemTypeDefinition {
  id: string;
  name: string;
  icon: WorkItemIcon;
  color: string;
  description?: string;
  isDefault?: boolean;
  customProperties: WorkItemCustomProperty[];
}

export type EstimateKind = 'points' | 'categories' | 'time';

export type EstimateSubKind =
  | 'points-linear'
  | 'points-fibonacci'
  | 'points-squares'
  | 'points-custom'
  | 'categories-tshirt'
  | 'categories-difficulty'
  | 'categories-custom'
  | 'time-preset'
  | 'time-custom';

export interface EstimateScale {
  kind: EstimateKind;
  subKind: EstimateSubKind;
  values: string[];
}

export interface ProjectSchemaSettings {
  workItemTypes: WorkItemTypeDefinition[];
  estimateScale: EstimateScale;
}

const STORAGE_PREFIX = 'project_schema_settings:';

export const WORK_ITEM_ICON_OPTIONS = [
  'book',
  'bug',
  'pin',
  'sparkles',
  'target',
  'flame',
  'lightbulb',
  'rocket',
] as const satisfies readonly WorkItemIcon[];

export const WORK_ITEM_COLOR_SWATCHES = [
  '#3B82F6',
  '#EF4444',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
] as const;

export const WORK_ITEM_CUSTOM_PROPERTY_TYPES = [
  'text',
  'number',
  'dropdown',
  'date',
  'member',
  'url',
  'boolean',
] as const satisfies readonly WorkItemCustomPropertyType[];

export const DEFAULT_WORK_ITEM_TYPES: WorkItemTypeDefinition[] = [
  {
    id: 'default-story',
    name: 'Story',
    icon: 'book',
    color: '#3B82F6',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-bug',
    name: 'Bug',
    icon: 'bug',
    color: '#EF4444',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-task',
    name: 'Task',
    icon: 'pin',
    color: '#6B7280',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-epic',
    name: 'Epic',
    icon: 'sparkles',
    color: '#8B5CF6',
    isDefault: true,
    customProperties: [],
  },
];

export const SUBKINDS_BY_KIND: Record<EstimateKind, EstimateSubKind[]> = {
  points: ['points-linear', 'points-fibonacci', 'points-squares', 'points-custom'],
  categories: ['categories-tshirt', 'categories-difficulty', 'categories-custom'],
  time: ['time-preset', 'time-custom'],
};

export const DEFAULT_ESTIMATE_SCALE: EstimateScale = {
  kind: 'points',
  subKind: 'points-fibonacci',
  values: ['1', '2', '3', '5', '8', '13', '21'],
};

export const PRESET_ESTIMATE_SCALES: Record<EstimateSubKind, EstimateScale | null> = {
  'points-linear': {
    kind: 'points',
    subKind: 'points-linear',
    values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
  'points-fibonacci': DEFAULT_ESTIMATE_SCALE,
  'points-squares': {
    kind: 'points',
    subKind: 'points-squares',
    values: ['1', '4', '9', '16', '25'],
  },
  'points-custom': null,
  'categories-tshirt': {
    kind: 'categories',
    subKind: 'categories-tshirt',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'categories-difficulty': {
    kind: 'categories',
    subKind: 'categories-difficulty',
    values: ['easy', 'medium', 'hard', 'very-hard'],
  },
  'categories-custom': null,
  'time-preset': {
    kind: 'time',
    subKind: 'time-preset',
    values: ['1h', '2h', '3h', '4h', '5h 30m', '6h 30m'],
  },
  'time-custom': null,
};

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function cloneWorkItemTypes(types: WorkItemTypeDefinition[]): WorkItemTypeDefinition[] {
  return types.map((type) => ({
    ...type,
    customProperties: type.customProperties.map((property) => ({
      ...property,
      ...(property.options ? { options: [...property.options] } : {}),
    })),
  }));
}

function cloneEstimateScale(scale: EstimateScale): EstimateScale {
  return { ...scale, values: [...scale.values] };
}

function isWorkItemIcon(value: unknown): value is WorkItemIcon {
  return WORK_ITEM_ICON_OPTIONS.includes(value as WorkItemIcon);
}

function isCustomPropertyType(value: unknown): value is WorkItemCustomPropertyType {
  return WORK_ITEM_CUSTOM_PROPERTY_TYPES.includes(value as WorkItemCustomPropertyType);
}

function isEstimateKind(value: unknown): value is EstimateKind {
  return value === 'points' || value === 'categories' || value === 'time';
}

function isEstimateSubKind(value: unknown): value is EstimateSubKind {
  return Object.prototype.hasOwnProperty.call(PRESET_ESTIMATE_SCALES, value as string);
}

function sanitizeColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return '#64748B';
}

function sanitizeProperty(raw: unknown): WorkItemCustomProperty | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!isCustomPropertyType(value.type)) return null;
  const options =
    value.type === 'dropdown' && Array.isArray(value.options)
      ? value.options
          .map((option) => (typeof option === 'string' ? option.trim() : ''))
          .filter(Boolean)
      : undefined;
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    required: typeof value.required === 'boolean' ? value.required : false,
    ...(options && options.length > 0 ? { options } : {}),
  };
}

function sanitizeWorkItemType(raw: unknown): WorkItemTypeDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  const customProperties = Array.isArray(value.customProperties)
    ? value.customProperties
        .map(sanitizeProperty)
        .filter((property): property is WorkItemCustomProperty => property !== null)
    : [];
  const description = typeof value.description === 'string' ? value.description : undefined;
  return {
    id: value.id,
    name: value.name,
    icon: isWorkItemIcon(value.icon) ? value.icon : 'pin',
    color: sanitizeColor(value.color),
    ...(description !== undefined ? { description } : {}),
    ...(typeof value.isDefault === 'boolean' ? { isDefault: value.isDefault } : {}),
    customProperties,
  };
}

export function kindOfSubKind(subKind: EstimateSubKind): EstimateKind {
  return subKind.split('-')[0] as EstimateKind;
}

export function isCustomSubKind(subKind: EstimateSubKind): boolean {
  return subKind.endsWith('-custom');
}

export function makeCustomScale(kind: EstimateKind, values: string[]): EstimateScale {
  return {
    kind,
    subKind: `${kind}-custom` as EstimateSubKind,
    values: values.map((value) => value.trim()).filter(Boolean),
  };
}

function sanitizeEstimateScale(raw: unknown): EstimateScale {
  if (!raw || typeof raw !== 'object') return cloneEstimateScale(DEFAULT_ESTIMATE_SCALE);
  const value = raw as Record<string, unknown>;
  if (!isEstimateSubKind(value.subKind)) return cloneEstimateScale(DEFAULT_ESTIMATE_SCALE);
  const kind = isEstimateKind(value.kind) ? value.kind : kindOfSubKind(value.subKind);
  if (kindOfSubKind(value.subKind) !== kind) return cloneEstimateScale(DEFAULT_ESTIMATE_SCALE);
  if (!isCustomSubKind(value.subKind)) {
    return cloneEstimateScale(PRESET_ESTIMATE_SCALES[value.subKind] ?? DEFAULT_ESTIMATE_SCALE);
  }
  const values = Array.isArray(value.values)
    ? value.values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 32)
    : [];
  return values.length >= 2 ? { kind, subKind: value.subKind, values } : makeCustomScale(kind, []);
}

export function createDefaultProjectSchemaSettings(): ProjectSchemaSettings {
  return {
    workItemTypes: cloneWorkItemTypes(DEFAULT_WORK_ITEM_TYPES),
    estimateScale: cloneEstimateScale(DEFAULT_ESTIMATE_SCALE),
  };
}

export function sanitizeProjectSchemaSettings(raw: unknown): ProjectSchemaSettings {
  if (!raw || typeof raw !== 'object') return createDefaultProjectSchemaSettings();
  const value = raw as Record<string, unknown>;
  const workItemTypes = Array.isArray(value.workItemTypes)
    ? value.workItemTypes
        .map(sanitizeWorkItemType)
        .filter((type): type is WorkItemTypeDefinition => type !== null)
    : [];
  return {
    workItemTypes:
      workItemTypes.length > 0 ? workItemTypes : cloneWorkItemTypes(DEFAULT_WORK_ITEM_TYPES),
    estimateScale: sanitizeEstimateScale(value.estimateScale),
  };
}

export function loadProjectSchemaSettings(projectId: string): ProjectSchemaSettings {
  try {
    const stored = mmkv.getString(storageKey(projectId));
    if (!stored) return createDefaultProjectSchemaSettings();
    return sanitizeProjectSchemaSettings(JSON.parse(stored) as unknown);
  } catch {
    return createDefaultProjectSchemaSettings();
  }
}

export function persistProjectSchemaSettings(
  projectId: string,
  settings: ProjectSchemaSettings,
): void {
  mmkv.set(storageKey(projectId), JSON.stringify(settings));
}

export interface UseProjectSchemaSettingsResult {
  workItemTypes: WorkItemTypeDefinition[];
  estimateScale: EstimateScale;
  isHydrated: boolean;
  addWorkItemType: (
    input: Pick<WorkItemTypeDefinition, 'name'> &
      Partial<Pick<WorkItemTypeDefinition, 'icon' | 'color'>>,
  ) => WorkItemTypeDefinition;
  updateWorkItemType: (
    id: string,
    patch: Partial<Omit<WorkItemTypeDefinition, 'id' | 'customProperties'>>,
  ) => void;
  removeWorkItemType: (id: string) => void;
  addCustomProperty: (
    typeId: string,
    input: Pick<WorkItemCustomProperty, 'name'> &
      Partial<Omit<WorkItemCustomProperty, 'id' | 'name'>>,
  ) => WorkItemCustomProperty | null;
  updateCustomProperty: (
    typeId: string,
    propertyId: string,
    patch: Partial<Omit<WorkItemCustomProperty, 'id'>>,
  ) => void;
  removeCustomProperty: (typeId: string, propertyId: string) => void;
  resetWorkItemTypes: () => void;
  updateEstimateScale: (scale: EstimateScale) => void;
  resetEstimateScale: () => void;
}

export function useProjectSchemaSettings(projectId: string): UseProjectSchemaSettingsResult {
  const [settings, setSettings] = useState<ProjectSchemaSettings>(() =>
    createDefaultProjectSchemaSettings(),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setSettings(loadProjectSchemaSettings(projectId));
    setIsHydrated(true);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isHydrated) return;
    persistProjectSchemaSettings(projectId, settings);
  }, [isHydrated, projectId, settings]);

  const addWorkItemType = useCallback<UseProjectSchemaSettingsResult['addWorkItemType']>(
    (input) => {
      const created: WorkItemTypeDefinition = {
        id: generateId('wit'),
        name: input.name.trim(),
        icon: input.icon && isWorkItemIcon(input.icon) ? input.icon : 'pin',
        color: sanitizeColor(input.color),
        isDefault: false,
        customProperties: [],
      };
      setSettings((current) => ({
        ...current,
        workItemTypes: [...current.workItemTypes, created],
      }));
      return created;
    },
    [],
  );

  const updateWorkItemType = useCallback<UseProjectSchemaSettingsResult['updateWorkItemType']>(
    (id, patch) => {
      setSettings((current) => ({
        ...current,
        workItemTypes: current.workItemTypes.map((type) => {
          if (type.id !== id) return type;
          const safePatch = { ...patch };
          delete safePatch.isDefault;
          return {
            ...type,
            ...safePatch,
            ...(patch.icon ? { icon: patch.icon } : {}),
            ...(patch.color ? { color: sanitizeColor(patch.color) } : {}),
            ...(type.isDefault ? { isDefault: true } : {}),
          };
        }),
      }));
    },
    [],
  );

  const removeWorkItemType = useCallback<UseProjectSchemaSettingsResult['removeWorkItemType']>(
    (id) => {
      setSettings((current) => ({
        ...current,
        workItemTypes: current.workItemTypes.filter((type) =>
          type.id === id ? !!type.isDefault : true,
        ),
      }));
    },
    [],
  );

  const addCustomProperty = useCallback<UseProjectSchemaSettingsResult['addCustomProperty']>(
    (typeId, input) => {
      const propertyType = input.type && isCustomPropertyType(input.type) ? input.type : 'text';
      const created: WorkItemCustomProperty = {
        id: generateId('prop'),
        name: input.name.trim(),
        type: propertyType,
        required: input.required ?? false,
        ...(propertyType === 'dropdown' ? { options: input.options ?? [] } : {}),
      };
      let didAdd = false;
      setSettings((current) => ({
        ...current,
        workItemTypes: current.workItemTypes.map((type) => {
          if (type.id !== typeId) return type;
          didAdd = true;
          return { ...type, customProperties: [...type.customProperties, created] };
        }),
      }));
      return didAdd ? created : null;
    },
    [],
  );

  const updateCustomProperty = useCallback<UseProjectSchemaSettingsResult['updateCustomProperty']>(
    (typeId, propertyId, patch) => {
      setSettings((current) => ({
        ...current,
        workItemTypes: current.workItemTypes.map((type) => {
          if (type.id !== typeId) return type;
          return {
            ...type,
            customProperties: type.customProperties.map((property) => {
              if (property.id !== propertyId) return property;
              const next: WorkItemCustomProperty = { ...property, ...patch };
              if (next.type === 'dropdown') {
                next.options = next.options && next.options.length > 0 ? next.options : [];
              } else {
                delete next.options;
              }
              return next;
            }),
          };
        }),
      }));
    },
    [],
  );

  const removeCustomProperty = useCallback<UseProjectSchemaSettingsResult['removeCustomProperty']>(
    (typeId, propertyId) => {
      setSettings((current) => ({
        ...current,
        workItemTypes: current.workItemTypes.map((type) =>
          type.id === typeId
            ? {
                ...type,
                customProperties: type.customProperties.filter(
                  (property) => property.id !== propertyId,
                ),
              }
            : type,
        ),
      }));
    },
    [],
  );

  const resetWorkItemTypes = useCallback(() => {
    setSettings((current) => ({
      ...current,
      workItemTypes: cloneWorkItemTypes(DEFAULT_WORK_ITEM_TYPES),
    }));
  }, []);

  const updateEstimateScale = useCallback((estimateScale: EstimateScale) => {
    setSettings((current) => ({ ...current, estimateScale: cloneEstimateScale(estimateScale) }));
  }, []);

  const resetEstimateScale = useCallback(() => {
    setSettings((current) => ({
      ...current,
      estimateScale: cloneEstimateScale(DEFAULT_ESTIMATE_SCALE),
    }));
  }, []);

  return useMemo(
    () => ({
      workItemTypes: settings.workItemTypes,
      estimateScale: settings.estimateScale,
      isHydrated,
      addWorkItemType,
      updateWorkItemType,
      removeWorkItemType,
      addCustomProperty,
      updateCustomProperty,
      removeCustomProperty,
      resetWorkItemTypes,
      updateEstimateScale,
      resetEstimateScale,
    }),
    [
      addCustomProperty,
      addWorkItemType,
      isHydrated,
      removeCustomProperty,
      removeWorkItemType,
      resetEstimateScale,
      resetWorkItemTypes,
      settings.estimateScale,
      settings.workItemTypes,
      updateCustomProperty,
      updateEstimateScale,
      updateWorkItemType,
    ],
  );
}
