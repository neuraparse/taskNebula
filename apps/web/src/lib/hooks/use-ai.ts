import { useMutation } from '@tanstack/react-query';

interface GenerateIssueRequest {
  description: string;
  projectId?: string;
}

interface GenerateIssueResponse {
  issue: {
    title: string;
    description: string;
    type: string;
    priority: string;
    estimate?: string;
    labels?: string[];
    projectId?: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface SummarizeThreadRequest {
  issueId: string;
}

interface SummarizeThreadResponse {
  summary: string;
  commentCount: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function useGenerateIssue() {
  return useMutation({
    mutationFn: async (request: GenerateIssueRequest) => {
      const response = await fetch('/api/ai/generate-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate issue');
      }

      return response.json() as Promise<GenerateIssueResponse>;
    },
  });
}

export function useSummarizeThread() {
  return useMutation({
    mutationFn: async (request: SummarizeThreadRequest) => {
      const response = await fetch('/api/ai/summarize-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to summarize thread');
      }

      return response.json() as Promise<SummarizeThreadResponse>;
    },
  });
}

