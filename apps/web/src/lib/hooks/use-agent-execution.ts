import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AgentExecution {
  id: string;
  workspaceId: string;
  issueId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  executorProfile: string;
  executorVariant: string;
  startedAt: Date;
  completedAt?: Date;
  exitCode?: number;
  error?: string;
  progress?: number;
}

export interface StartAgentExecutionParams {
  issueId: string;
  executorProfile: string;
  executorVariant?: string;
  initialPrompt?: string;
}

export function useAgentExecution(executionId?: string) {
  return useQuery<AgentExecution>({
    queryKey: ['agent-execution', executionId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/executions/${executionId}`);
      if (!res.ok) throw new Error('Failed to fetch execution');
      return res.json();
    },
    enabled: !!executionId,
    refetchInterval: 2000, // Poll every 2 seconds for status updates
  });
}

export function useStartAgentExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: StartAgentExecutionParams) => {
      const res = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to start execution');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-executions'] });
    },
  });
}

export function useStopAgentExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (executionId: string) => {
      const res = await fetch(`/api/agents/executions/${executionId}/stop`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to stop execution');
      return res.json();
    },
    onSuccess: (_, executionId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-execution', executionId] });
    },
  });
}

export function useAgentExecutions(issueId?: string) {
  return useQuery<AgentExecution[]>({
    queryKey: ['agent-executions', issueId],
    queryFn: async () => {
      const url = issueId
        ? `/api/agents/executions?issueId=${issueId}`
        : '/api/agents/executions';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch executions');
      return res.json();
    },
    refetchInterval: 5000,
  });
}
