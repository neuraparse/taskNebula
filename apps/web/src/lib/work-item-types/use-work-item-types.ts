'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type CustomPropertyType =
  | 'text'
  | 'number'
  | 'dropdown'
  | 'date'
  | 'member'
  | 'url'
  | 'boolean';

export interface CustomProperty {
  id: string;
  name: string;
  type: CustomPropertyType;
  required: boolean;
  /** Only used when type === 'dropdown'. */
  options?: string[];
}

export interface WorkItemType {
  id: string;
  name: string;
  /** Single emoji glyph used to render the type. */
  icon: string;
  /** Hex color (e.g. '#3B82F6'). */
  color: string;
  description?: string;
  /** Built-in seed types cannot be deleted. */
  isDefault?: boolean;
  customProperties: CustomProperty[];
}

export interface UseWorkItemTypesResult {
  types: WorkItemType[];
  isHydrated: boolean;
  addType: (input?: Partial<Omit<WorkItemType, 'id' | 'customProperties'>>) => WorkItemType;
  updateType: (id: string, patch: Partial<Omit<WorkItemType, 'id'>>) => void;
  removeType: (id: string) => void;
  addProperty: (
    typeId: string,
    input?: Partial<Omit<CustomProperty, 'id'>>
  ) => CustomProperty | null;
  updateProperty: (
    typeId: string,
    propertyId: string,
    patch: Partial<Omit<CustomProperty, 'id'>>
  ) => void;
  removeProperty: (typeId: string, propertyId: string) => void;
  reset: () => void;
}

const STORAGE_PREFIX = 'tn:work-item-types:';

export const DEFAULT_WORK_ITEM_TYPES: WorkItemType[] = [
  {
    id: 'default-story',
    name: 'Story',
    icon: '📖',
    color: '#3B82F6',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-bug',
    name: 'Bug',
    icon: '🐛',
    color: '#EF4444',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-task',
    name: 'Task',
    icon: '📌',
    color: '#6B7280',
    isDefault: true,
    customProperties: [],
  },
  {
    id: 'default-epic',
    name: 'Epic',
    icon: '✨',
    color: '#8B5CF6',
    isDefault: true,
    customProperties: [],
  },
];

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function cloneDefaults(): WorkItemType[] {
  return DEFAULT_WORK_ITEM_TYPES.map((type) => ({
    ...type,
    customProperties: type.customProperties.map((p) => ({ ...p })),
  }));
}

function isCustomPropertyType(value: unknown): value is CustomPropertyType {
  return (
    value === 'text' ||
    value === 'number' ||
    value === 'dropdown' ||
    value === 'date' ||
    value === 'member' ||
    value === 'url' ||
    value === 'boolean'
  );
}

function sanitizeProperty(raw: unknown): CustomProperty | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return null;
  if (!isCustomPropertyType(obj.type)) return null;
  const required = typeof obj.required === 'boolean' ? obj.required : false;
  const options =
    obj.type === 'dropdown' && Array.isArray(obj.options)
      ? obj.options.filter((o): o is string => typeof o === 'string')
      : undefined;
  return {
    id: obj.id,
    name: obj.name,
    type: obj.type,
    required,
    ...(options ? { options } : {}),
  };
}

function sanitizeType(raw: unknown): WorkItemType | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    typeof obj.icon !== 'string' ||
    typeof obj.color !== 'string'
  ) {
    return null;
  }
  const description = typeof obj.description === 'string' ? obj.description : undefined;
  const isDefault = typeof obj.isDefault === 'boolean' ? obj.isDefault : undefined;
  const customProperties = Array.isArray(obj.customProperties)
    ? obj.customProperties.map(sanitizeProperty).filter((p): p is CustomProperty => p !== null)
    : [];
  return {
    id: obj.id,
    name: obj.name,
    icon: obj.icon,
    color: obj.color,
    ...(description !== undefined ? { description } : {}),
    ...(isDefault !== undefined ? { isDefault } : {}),
    customProperties,
  };
}

function loadFromStorage(projectId: string): WorkItemType[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.map(sanitizeType).filter((t): t is WorkItemType => t !== null);
    return cleaned;
  } catch {
    return null;
  }
}

function persistToStorage(projectId: string, types: WorkItemType[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(types));
  } catch {
    // Quota / privacy mode — silently ignore; caller still has in-memory state.
  }
}

export function useWorkItemTypes(projectId: string): UseWorkItemTypesResult {
  // Start with defaults so SSR + first client paint match.
  const [types, setTypes] = useState<WorkItemType[]>(() => cloneDefaults());
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage when projectId becomes available / changes.
  useEffect(() => {
    if (!projectId) return;
    const stored = loadFromStorage(projectId);
    if (stored && stored.length > 0) {
      setTypes(stored);
    } else {
      setTypes(cloneDefaults());
    }
    setIsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Persist whenever types change after hydration.
  useEffect(() => {
    if (!projectId || !isHydrated) return;
    persistToStorage(projectId, types);
  }, [projectId, types, isHydrated]);

  const addType = useCallback<UseWorkItemTypesResult['addType']>((input) => {
    const created: WorkItemType = {
      id: generateId('wit'),
      name: input?.name?.trim() || 'New type',
      icon: input?.icon || '📌',
      color: input?.color || '#64748B',
      description: input?.description,
      isDefault: false,
      customProperties: [],
    };
    setTypes((prev) => [...prev, created]);
    return created;
  }, []);

  const updateType = useCallback<UseWorkItemTypesResult['updateType']>((id, patch) => {
    setTypes((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next: WorkItemType = { ...t, ...patch };
        // Preserve immutability of defaults' isDefault flag.
        if (t.isDefault) next.isDefault = true;
        return next;
      })
    );
  }, []);

  const removeType = useCallback<UseWorkItemTypesResult['removeType']>((id) => {
    setTypes((prev) => prev.filter((t) => (t.id === id ? !!t.isDefault : true)));
  }, []);

  const addProperty = useCallback<UseWorkItemTypesResult['addProperty']>((typeId, input) => {
    const type = input?.type && isCustomPropertyType(input.type) ? input.type : 'text';
    const created: CustomProperty = {
      id: generateId('prop'),
      name: input?.name?.trim() || 'New property',
      type,
      required: input?.required ?? false,
      ...(type === 'dropdown' ? { options: input?.options ?? ['Option 1'] } : {}),
    };
    let didAdd = false;
    setTypes((prev) =>
      prev.map((t) => {
        if (t.id !== typeId) return t;
        didAdd = true;
        return { ...t, customProperties: [...t.customProperties, created] };
      })
    );
    return didAdd ? created : null;
  }, []);

  const updateProperty = useCallback<UseWorkItemTypesResult['updateProperty']>(
    (typeId, propertyId, patch) => {
      setTypes((prev) =>
        prev.map((t) => {
          if (t.id !== typeId) return t;
          return {
            ...t,
            customProperties: t.customProperties.map((p) => {
              if (p.id !== propertyId) return p;
              const merged: CustomProperty = { ...p, ...patch };
              // If type changed away from dropdown, drop options.
              if (merged.type !== 'dropdown') {
                delete merged.options;
              } else if (!merged.options || merged.options.length === 0) {
                merged.options = ['Option 1'];
              }
              return merged;
            }),
          };
        })
      );
    },
    []
  );

  const removeProperty = useCallback<UseWorkItemTypesResult['removeProperty']>(
    (typeId, propertyId) => {
      setTypes((prev) =>
        prev.map((t) =>
          t.id === typeId
            ? {
                ...t,
                customProperties: t.customProperties.filter((p) => p.id !== propertyId),
              }
            : t
        )
      );
    },
    []
  );

  const reset = useCallback(() => {
    setTypes(cloneDefaults());
  }, []);

  return useMemo(
    () => ({
      types,
      isHydrated,
      addType,
      updateType,
      removeType,
      addProperty,
      updateProperty,
      removeProperty,
      reset,
    }),
    [
      types,
      isHydrated,
      addType,
      updateType,
      removeType,
      addProperty,
      updateProperty,
      removeProperty,
      reset,
    ]
  );
}
