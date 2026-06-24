'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const TEMPLATE_KINDS = ['project', 'issue', 'doc'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface ApiTemplate {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string | null;
  kind: TemplateKind;
  payload: Record<string, unknown>;
  usageCount: number;
  isPublic: boolean;
  isVerified: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatesListResponse {
  templates: ApiTemplate[];
  canAdminister: boolean;
  adminOrganizationIds: string[];
  memberOrganizationIds: string[];
}

const TEMPLATES_QUERY_KEY = ['templates'] as const;

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = (parsed as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return parsed as T;
}

export function useTemplatesList() {
  return useQuery<TemplatesListResponse>({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () => fetchJson<TemplatesListResponse>('/api/templates'),
  });
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  kind: TemplateKind;
  category?: string;
  icon?: string | null;
  payload?: Record<string, unknown>;
  organizationId?: string;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      fetchJson<ApiTemplate>('/api/templates', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
  });
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }: UpdateTemplateInput) =>
      fetchJson<ApiTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
  });
}

export interface UseTemplateOverrides {
  name?: string;
  key?: string;
  title?: string;
  projectId?: string;
  description?: string | null;
}

export interface UseTemplateResult {
  kind: TemplateKind;
  resource?: { id: string; key?: string; name?: string; title?: string };
  payload?: Record<string, unknown>;
  templateId?: string;
  message?: string;
}

export function useInstantiateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, overrides }: { id: string; overrides?: UseTemplateOverrides }) =>
      fetchJson<UseTemplateResult>(`/api/templates/${encodeURIComponent(id)}/use`, {
        method: 'POST',
        body: JSON.stringify({ overrides: overrides ?? {} }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
  });
}
