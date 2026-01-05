'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'url' | 'email';

interface CustomField {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  type: CustomFieldType;
  isRequired: boolean;
  defaultValue: string | null;
  options: string | null;
  position: number;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomFieldValue {
  id: string;
  customFieldId: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
  field: {
    id: string;
    name: string;
    description: string | null;
    type: CustomFieldType;
    isRequired: boolean;
    options: string | null;
  };
}

interface CustomFieldsResponse {
  customFields: CustomField[];
}

interface CustomFieldValuesResponse {
  customFieldValues: CustomFieldValue[];
}

// Fetch custom fields for organization/project
export function useCustomFields(organizationId: string, projectId?: string) {
  return useQuery({
    queryKey: ['custom-fields', organizationId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`/api/custom-fields?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch custom fields');
      }
      return response.json() as Promise<CustomFieldsResponse>;
    },
    enabled: !!organizationId,
  });
}

// Fetch custom field values for an issue
export function useCustomFieldValues(issueId: string) {
  return useQuery({
    queryKey: ['custom-field-values', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}/custom-fields`);
      if (!response.ok) {
        throw new Error('Failed to fetch custom field values');
      }
      return response.json() as Promise<CustomFieldValuesResponse>;
    },
    enabled: !!issueId,
  });
}

// Create custom field
export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      projectId?: string;
      name: string;
      description?: string;
      type: CustomFieldType;
      isRequired?: boolean;
      defaultValue?: string;
      options?: string;
    }) => {
      const response = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create custom field');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', variables.organizationId] });
    },
  });
}

// Update custom field
export function useUpdateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, ...data }: {
      fieldId: string;
      name?: string;
      description?: string;
      isRequired?: boolean;
      defaultValue?: string;
      options?: string;
      position?: number;
      isActive?: boolean;
    }) => {
      const response = await fetch(`/api/custom-fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update custom field');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });
}

// Delete custom field
export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldId: string) => {
      const response = await fetch(`/api/custom-fields/${fieldId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete custom field');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });
}

// Set custom field value for an issue
export function useSetCustomFieldValue(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { customFieldId: string; value: string | null }) => {
      const response = await fetch(`/api/issues/${issueId}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to set custom field value');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-values', issueId] });
    },
  });
}

