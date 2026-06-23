'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { throwApiResponseError } from '@/lib/client-api-errors';

interface DocumentSpace {
  id: string;
  organizationId: string;
  projectId: string | null;
  scope: 'organization' | 'project';
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  permissions?: {
    canBrowse: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

export interface DocumentShareSettings {
  canManagePublic: boolean;
  internalPath: string;
  public: {
    enabled: boolean;
    urlPath: string | null;
    allowSearchIndexing: boolean;
    includeAttachments: boolean;
    publishedAt: string | null;
  };
}

export interface DocumentShareUpdateInput {
  enablePublic?: boolean;
  allowSearchIndexing?: boolean;
  includeAttachments?: boolean;
  regenerateToken?: boolean;
}

export interface DocumentPage {
  id: string;
  spaceId: string;
  organizationId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  slug: string;
  icon: string | null;
  contentJson: Record<string, unknown>;
  contentText: string;
  excerpt: string | null;
  currentRevision: number;
  position: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  permissions?: {
    canBrowse: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  backlinks?: Array<{ id: string; title: string; slug: string; projectId: string | null }>;
  relatedIssues?: Array<{
    linkId: string;
    id: string;
    key: string;
    title: string;
    projectId: string;
    priority: string;
    statusId: string;
  }>;
  attachments?: Array<DocumentAttachment>;
  revisionCount?: number;
  space?: DocumentSpace;
  share?: DocumentShareSettings;
}

export type DocumentPageSummary = Pick<
  DocumentPage,
  | 'id'
  | 'spaceId'
  | 'organizationId'
  | 'projectId'
  | 'parentId'
  | 'title'
  | 'slug'
  | 'icon'
  | 'excerpt'
  | 'currentRevision'
  | 'position'
  | 'isArchived'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
>;

export interface DocumentRevision {
  id: string;
  pageId: string;
  revision: number;
  title: string;
  contentText?: string;
  excerpt: string | null;
  changeSummary: string | null;
  createdAt: string;
  createdBy: string;
  author?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export interface DocumentTreeNode {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  icon: string | null;
  projectId: string | null;
  currentRevision: number;
  updatedAt: string;
  children: DocumentTreeNode[];
}

export interface DocumentAttachment {
  id: string;
  pageId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedById: string;
  createdAt: string;
}

export function useDocumentSpaces(filters?: {
  organizationId?: string | null;
  projectId?: string | null;
}) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-spaces', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.organizationId) params.append('organizationId', filters.organizationId);
      if (filters?.projectId) params.append('projectId', filters.projectId);
      const response = await fetch(`/api/docs/spaces?${params.toString()}`);
      if (!response.ok) await throwApiResponseError(response, t('fetchSpaces'));
      const data = await response.json();
      return data.spaces as DocumentSpace[];
    },
  });
}

export function useDocumentPages(filters?: {
  spaceId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
}) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-pages', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.spaceId) params.append('spaceId', filters.spaceId);
      if (filters?.organizationId) params.append('organizationId', filters.organizationId);
      if (filters?.projectId) params.append('projectId', filters.projectId);
      const response = await fetch(`/api/docs/pages?${params.toString()}`);
      if (!response.ok) await throwApiResponseError(response, t('fetchPages'));
      return response.json() as Promise<{
        space: DocumentSpace | null;
        permissions: DocumentSpace['permissions'];
        pages: DocumentPageSummary[];
      }>;
    },
  });
}

export function useDocumentPage(pageId: string | null) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-page', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const response = await fetch(`/api/docs/pages/${pageId}`);
      if (!response.ok) await throwApiResponseError(response, t('fetchPage'));
      return response.json() as Promise<DocumentPage>;
    },
    enabled: !!pageId,
  });
}

export function useDocumentTree(pageId: string | null) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-tree', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const response = await fetch(`/api/docs/pages/${pageId}/tree`);
      if (!response.ok) await throwApiResponseError(response, t('fetchTree'));
      return response.json() as Promise<{
        tree: DocumentTreeNode[];
        currentPageId: string;
        space: DocumentSpace;
      }>;
    },
    enabled: !!pageId,
  });
}

export function useDocumentRevisions(pageId: string | null, options: { enabled?: boolean } = {}) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-revisions', pageId],
    queryFn: async () => {
      if (!pageId) return [];
      const response = await fetch(`/api/docs/pages/${pageId}/revisions`);
      if (!response.ok) await throwApiResponseError(response, t('fetchRevisions'));
      const data = await response.json();
      return data.revisions as DocumentRevision[];
    },
    enabled: !!pageId && options.enabled !== false,
  });
}

export function useDocumentSearch(filters: {
  query: string;
  organizationId?: string | null;
  projectId?: string | null;
  enabled?: boolean;
}) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-search', filters.query, filters.organizationId, filters.projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.query) params.append('q', filters.query);
      if (filters.organizationId) params.append('organizationId', filters.organizationId);
      if (filters.projectId) params.append('projectId', filters.projectId);
      params.append('limit', '10');

      const response = await fetch(`/api/docs/search?${params.toString()}`);
      if (!response.ok) await throwApiResponseError(response, t('search'));
      const data = await response.json();
      return data.results as Array<{
        id: string;
        title: string;
        slug: string;
        icon: string | null;
        excerpt: string | null;
        projectId: string | null;
        spaceId: string;
        updatedAt: string;
        rank: number;
        spaceName: string;
      }>;
    },
    enabled: filters.enabled !== false,
  });
}

export function useCreateDocumentPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (data: {
      title: string;
      icon?: string | null;
      parentId?: string | null;
      spaceId?: string;
      organizationId?: string;
      projectId?: string;
      changeSummary?: string;
      contentJson?: Record<string, unknown>;
    }) => {
      const response = await fetch('/api/docs/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response, t('createPage'));
      }
      return response.json() as Promise<DocumentPage>;
    },
    onSuccess: (page, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document-pages'] });
      queryClient.invalidateQueries({ queryKey: ['document-spaces'] });
      if (variables.parentId) {
        queryClient.invalidateQueries({ queryKey: ['document-tree'] });
      }
      queryClient.setQueryData(['document-page', page.id], page);
      queryClient.invalidateQueries({ queryKey: ['document-page', page.id] });
    },
  });
}

export function useUpdateDocumentPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async ({
      pageId,
      data,
    }: {
      pageId: string;
      data: {
        title?: string;
        icon?: string | null;
        contentJson?: Record<string, unknown>;
        changeSummary?: string;
        expectedRevision: number;
      };
    }) => {
      const response = await fetch(`/api/docs/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response, t('updatePage'));
      }
      return response.json() as Promise<DocumentPage>;
    },
    onSuccess: (page) => {
      queryClient.setQueryData(['document-page', page.id], page);
      queryClient.invalidateQueries({ queryKey: ['document-page', page.id] });
      queryClient.invalidateQueries({ queryKey: ['document-pages'] });
      queryClient.invalidateQueries({ queryKey: ['document-tree'] });
      queryClient.invalidateQueries({ queryKey: ['document-revisions', page.id] });
      queryClient.invalidateQueries({ queryKey: ['document-search'] });
    },
  });
}

export function useRestoreDocumentPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async ({
      pageId,
      revision,
      revisionId,
    }: {
      pageId: string;
      revision?: number;
      revisionId?: string;
    }) => {
      const response = await fetch(`/api/docs/pages/${pageId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, revisionId }),
      });
      if (!response.ok) {
        await throwApiResponseError(response, t('restoreRevision'));
      }
      return response.json() as Promise<DocumentPage>;
    },
    onSuccess: (page) => {
      queryClient.setQueryData(['document-page', page.id], page);
      queryClient.invalidateQueries({ queryKey: ['document-page', page.id] });
      queryClient.invalidateQueries({ queryKey: ['document-pages'] });
      queryClient.invalidateQueries({ queryKey: ['document-tree'] });
      queryClient.invalidateQueries({ queryKey: ['document-revisions', page.id] });
    },
  });
}

export function useUpdateDocumentShare(pageId: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (data: DocumentShareUpdateInput) => {
      if (!pageId) {
        throw new Error(t('openPageBeforeSharing'));
      }

      const response = await fetch(`/api/docs/pages/${pageId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('updateSharing'));
      }

      return response.json() as Promise<DocumentPage>;
    },
    onSuccess: (page) => {
      queryClient.setQueryData(['document-page', page.id], page);
      queryClient.invalidateQueries({ queryKey: ['document-page', page.id] });
      queryClient.invalidateQueries({ queryKey: ['document-pages'] });
      queryClient.invalidateQueries({ queryKey: ['document-search'] });
    },
  });
}

export function useIssueDocs(issueId: string | null) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['issue-docs', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const response = await fetch(`/api/issues/${issueId}/docs`);
      if (!response.ok) await throwApiResponseError(response, t('fetchIssueDocs'));
      const data = await response.json();
      return data.docs as Array<{
        linkId: string;
        id: string;
        spaceId: string;
        title: string;
        icon: string | null;
        slug: string;
        excerpt: string | null;
        projectId: string | null;
        updatedAt: string;
      }>;
    },
    enabled: !!issueId,
  });
}

export function useAttachIssueDoc(issueId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (data: { pageId?: string; createNew?: boolean; title?: string }) => {
      const response = await fetch(`/api/issues/${issueId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response, t('attachDoc'));
      }
      return response.json();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueId] });
      const maybePageId = variables.pageId;
      if (maybePageId) {
        queryClient.invalidateQueries({ queryKey: ['document-page', maybePageId] });
      }
      const createdPage = result?.page as DocumentPage | undefined;
      if (createdPage?.id) {
        queryClient.setQueryData(['document-page', createdPage.id], createdPage);
        queryClient.invalidateQueries({ queryKey: ['document-page', createdPage.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['document-pages'] });
    },
  });
}

export function useDetachIssueDoc(issueId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (pageId: string) => {
      const response = await fetch(`/api/issues/${issueId}/docs?pageId=${pageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        await throwApiResponseError(response, t('detachDoc'));
      }
      return response.json();
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueId] });
      queryClient.invalidateQueries({ queryKey: ['document-page', pageId] });
    },
  });
}

export function useDocumentAttachments(pageId: string | null, options: { enabled?: boolean } = {}) {
  const t = useTranslations('hookErrors.docs');

  return useQuery({
    queryKey: ['document-attachments', pageId],
    queryFn: async () => {
      if (!pageId) return [];
      const response = await fetch(`/api/docs/pages/${pageId}/attachments`);
      if (!response.ok) await throwApiResponseError(response, t('fetchAttachments'));
      const data = await response.json();
      return data.attachments as DocumentAttachment[];
    },
    enabled: !!pageId && options.enabled !== false,
  });
}

export function useUploadDocumentAttachment(pageId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/docs/pages/${pageId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('uploadAttachment'));
      }

      return response.json() as Promise<{ attachment: DocumentAttachment }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-attachments', pageId] });
      queryClient.invalidateQueries({ queryKey: ['document-page', pageId] });
    },
  });
}

export function useDeleteDocumentAttachment(pageId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.docs');

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(
        `/api/docs/pages/${pageId}/attachments?attachmentId=${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        await throwApiResponseError(response, t('deleteAttachment'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-attachments', pageId] });
      queryClient.invalidateQueries({ queryKey: ['document-page', pageId] });
    },
  });
}
