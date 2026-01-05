import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Attachment {
  id: string;
  issueId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedById: string;
  createdAt: string | Date;
}

interface AttachmentsResponse {
  attachments: Attachment[];
}

export function useAttachments(issueId: string) {
  return useQuery({
    queryKey: ['attachments', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}/attachments`);
      if (!response.ok) {
        throw new Error('Failed to fetch attachments');
      }
      const data: AttachmentsResponse = await response.json();
      return data.attachments;
    },
  });
}

export function useUploadAttachment(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/issues/${issueId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', issueId] });
    },
  });
}

export function useDeleteAttachment(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(
        `/api/issues/${issueId}/attachments?attachmentId=${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', issueId] });
    },
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

