'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type AgentModelConfig = {
  id: string;
  organizationId: string;
  name: string;
  provider: 'native' | 'openai' | 'anthropic' | 'azure' | 'custom';
  model: string;
  description: string | null;
  settings: {
    temperature: number | null;
    maxOutputTokens: number | null;
    reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | null;
    notes: string | null;
  };
  isDefault: boolean;
  isArchived: boolean;
  revisionCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceAgentResponse = {
  organizationId: string;
  organizationName: string;
  workspaceSettings: {
    enabled: boolean;
    modelConfigId?: string | null;
    provider: 'native' | 'openai' | 'anthropic' | 'azure' | 'custom';
    model: string;
    executionMode: 'manual' | 'assistive' | 'auto';
    allowWriteActions: boolean;
    requireApprovalForWrites: boolean;
    dailyRunLimit: number;
    capabilities: Record<string, boolean>;
  };
  selectedModelConfig: AgentModelConfig | null;
  modelConfigs: AgentModelConfig[];
  access: {
    canView: boolean;
    canManage: boolean;
    orgRole: string | null;
    isSuperAdmin: boolean;
  };
  providerStatus: {
    ready: boolean;
    summary: string;
    configured: boolean;
    source: 'workspace' | 'server_env' | null;
    label: string | null;
    updatedAt: string | null;
  };
  configIssues: Array<{
    code: string;
    scope: 'system' | 'workspace' | 'project' | 'provider';
    severity: 'error' | 'warning' | 'info';
    title: string;
    detail: string;
    resolution: string;
    blocksRuns: boolean;
  }>;
  runtimeSummary: {
    projectCount: number;
    enabledProjectCount: number;
    runningRuns: number;
    totalRuns: number;
    lastRunAt: string | null;
    lastCompletedAt: string | null;
    lastFailedAt: string | null;
    lastFailure: string | null;
  };
  serviceStatus: Array<{
    key: string;
    label: string;
    state: 'ready' | 'blocked' | 'disabled' | 'preview';
    detail: string;
  }>;
  recentRuns: Array<{
    id: string;
    kind: string;
    status: string;
    dryRun: boolean;
    summary: string | null;
    writeActionsCount: number;
    createdAt: string;
    completedAt: string | null;
    error: string | null;
    projectId: string | null;
    projectName: string | null;
    initiatedBy: string | null;
  }>;
  updatedAt: string;
};

type ProjectAgentsResponse = {
  project: {
    id: string;
    key: string;
    name: string;
  };
  access: {
    canView: boolean;
    canManage: boolean;
    orgRole: string | null;
    projectRole: string | null;
    isSuperAdmin: boolean;
  };
  workspaceSettings: WorkspaceAgentResponse['workspaceSettings'];
  selectedModelConfig: AgentModelConfig | null;
  projectSettings: {
    enabled: boolean;
    inheritWorkspaceDefaults: boolean;
    executionMode: 'manual' | 'assistive' | 'auto';
    allowWriteActions: boolean;
    sprintBatchSize: number;
    sprintLengthDays: number;
    issueCapacityPerSprint: number;
    autoAssignToPlannedSprints: boolean;
    capabilities: Record<string, boolean>;
  };
  effectiveSettings: {
    enabled: boolean;
    allowWriteActions: boolean;
    executionMode: 'manual' | 'assistive' | 'auto';
    provider: 'native' | 'openai' | 'anthropic' | 'azure' | 'custom';
    model: string;
    requireApprovalForWrites: boolean;
    dailyRunLimit: number;
    sprintBatchSize: number;
    sprintLengthDays: number;
    issueCapacityPerSprint: number;
    autoAssignToPlannedSprints: boolean;
    capabilities: Record<string, boolean>;
  };
  providerStatus: {
    ready: boolean;
    summary: string;
    configured: boolean;
    source: 'workspace' | 'server_env' | null;
    label: string | null;
    updatedAt: string | null;
  };
  configIssues: Array<{
    code: string;
    scope: 'system' | 'workspace' | 'project' | 'provider';
    severity: 'error' | 'warning' | 'info';
    title: string;
    detail: string;
    resolution: string;
    blocksRuns: boolean;
  }>;
  runtimeSummary: {
    runningRuns: number;
    lastRunAt: string | null;
    lastCompletedAt: string | null;
    lastFailedAt: string | null;
    lastFailure: string | null;
  };
  runAvailability: {
    canRun: boolean;
    reason: string | null;
  };
  serviceStatus: Array<{
    key: string;
    label: string;
    state: 'ready' | 'blocked' | 'disabled' | 'preview';
    detail: string;
  }>;
  lastRunByKind: Record<string, {
    id: string;
    kind: string;
    status: string;
    dryRun: boolean;
    summary: string | null;
    writeActionsCount: number;
    createdAt: string;
    completedAt: string | null;
    mode: string;
    output: Record<string, unknown>;
    error: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    kind: string;
    status: string;
    dryRun: boolean;
    summary: string | null;
    writeActionsCount: number;
    createdAt: string;
    completedAt: string | null;
    mode: string;
    output: Record<string, unknown>;
    error: string | null;
  }>;
};

type ProjectAgentRunResponse = {
  run: ProjectAgentsResponse['recentRuns'][number];
  output: Record<string, unknown>;
  dryRun: boolean;
  forcedDryRun: boolean;
  error?: string;
  errorCode?: string;
};

type AdminAgentControlResponse = {
  settings: {
    globalEnabled: boolean;
    allowWriteActions: boolean;
    requireSupervisionForAutoMode: boolean;
    maxConcurrentRuns: number;
  };
  stats: {
    enabledWorkspaceCount: number;
    enabledProjectCount: number;
    recentRunCount: number;
    runningRuns: number;
    failedRuns: number;
    readyWorkspaceCount: number;
    blockedWorkspaceCount: number;
  };
  serviceStatus: Array<{
    key: string;
    label: string;
    state: 'ready' | 'blocked' | 'disabled' | 'preview';
    detail: string;
  }>;
  providerBreakdown: Record<string, {
    total: number;
    enabled: number;
    ready: number;
    blocked: number;
  }>;
  workspaceCoverage: Array<{
    organizationId: string;
    organizationName: string;
    workspaceEnabled: boolean;
    enabledProjects: number;
    provider: 'native' | 'openai' | 'anthropic' | 'azure' | 'custom';
    model: string;
    selectedModelConfigId: string | null;
    selectedModelConfigName: string | null;
    executionMode: 'manual' | 'assistive' | 'auto';
    providerStatus: {
      ready: boolean;
      summary: string;
      configured: boolean;
      source: 'workspace' | 'server_env' | null;
      label: string | null;
      updatedAt: string | null;
    };
    lastRunAt: string | null;
    lastFailure: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    kind: string;
    status: string;
    dryRun: boolean;
    summary: string | null;
    writeActionsCount: number;
    createdAt: string;
    organizationId: string | null;
    organizationName: string | null;
    projectId: string | null;
    projectName: string | null;
    initiatedBy: string | null;
  }>;
};

type AgentStreamLogEvent = {
  type: 'log';
  data: {
    executionId: string;
    projectId: string;
    logIndex: number;
    type: 'stdout' | 'stderr' | 'system';
    content: string;
    timestamp: string;
  };
};

type AgentStreamStatusEvent = {
  type: 'status';
  data: {
    executionId: string;
    projectId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    error?: string;
    timestamp: string;
  };
};

type AgentStreamEvent = AgentStreamLogEvent | AgentStreamStatusEvent;

export type AgentLiveRun = {
  executionId: string;
  projectId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error: string | null;
  updatedAt: string;
  logs: Array<{
    logIndex: number;
    type: 'stdout' | 'stderr' | 'system';
    content: string;
    timestamp: string;
  }>;
};

function reduceAgentStreamEvent(
  current: Record<string, AgentLiveRun>,
  event: AgentStreamEvent
) {
  const next = { ...current };
  const runId = event.data.executionId;
  const existing = next[runId] ?? {
    executionId: runId,
    projectId: event.data.projectId,
    status: 'running' as const,
    progress: 0,
    error: null,
    updatedAt: event.data.timestamp,
    logs: [],
  };

  if (event.type === 'log') {
    const nextLogs = [...existing.logs, event.data]
      .sort((left, right) => left.logIndex - right.logIndex)
      .filter((log, index, logs) => logs.findIndex((item) => item.logIndex === log.logIndex) === index)
      .slice(-40);

    next[runId] = {
      ...existing,
      updatedAt: event.data.timestamp,
      logs: nextLogs,
    };

    return next;
  }

  next[runId] = {
    ...existing,
    status: event.data.status,
    progress: event.data.progress ?? existing.progress,
    error: event.data.error ?? null,
    updatedAt: event.data.timestamp,
  };

  return next;
}

function useAgentStream(params: {
  url: string | null;
  enabled: boolean;
  invalidateKeys: Array<readonly unknown[]>;
}) {
  const queryClient = useQueryClient();
  const [liveRuns, setLiveRuns] = useState<Record<string, AgentLiveRun>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const invalidateKeysKey = JSON.stringify(params.invalidateKeys);

  useEffect(() => {
    if (!params.enabled || !params.url) {
      setIsConnected(false);
      setLiveRuns({});
      return;
    }

    const source = new EventSource(params.url);

    source.onopen = () => {
      setIsConnected(true);
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AgentStreamEvent;
        setLastEventAt(event.data.timestamp);
        setLiveRuns((current) => reduceAgentStreamEvent(current, event));

        if (event.type === 'status') {
          params.invalidateKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey: [...queryKey] });
          });

          if (event.data.status === 'completed' || event.data.status === 'failed' || event.data.status === 'cancelled') {
            setTimeout(() => {
              setLiveRuns((current) => {
                const next = { ...current };
                delete next[event.data.executionId];
                return next;
              });
            }, 10000);
          }
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    source.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      source.close();
      setIsConnected(false);
    };
  }, [invalidateKeysKey, params.enabled, params.url, queryClient]);

  const runs = useMemo(
    () =>
      Object.values(liveRuns).sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [liveRuns]
  );

  return {
    isConnected,
    lastEventAt,
    liveRuns: runs,
  };
}

export function useOrganizationAgentSettings(organizationId: string | null) {
  return useQuery<WorkspaceAgentResponse>({
    queryKey: ['organization-ai-agents', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/ai-agents`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch workspace AI agents' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch workspace AI agents');
      }
      return payload;
    },
    enabled: !!organizationId,
  });
}

export function useUpdateOrganizationAgentSettings(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/organizations/${organizationId}/ai-agents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update workspace AI agents' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update workspace AI agents');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-ai-agents', organizationId] });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'project-ai-agents' || query.queryKey[0] === 'admin-agent-control',
      });
    },
  });
}

export function useCreateOrganizationAgentModelConfig(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/organizations/${organizationId}/ai-model-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to create AI model config' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create AI model config');
      }
      return payload as { config: AgentModelConfig | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-ai-agents', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-agent-control'] });
    },
  });
}

export function useUpdateOrganizationAgentModelConfig(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { configId: string; data: Record<string, unknown> }) => {
      const response = await fetch(`/api/organizations/${organizationId}/ai-model-configs/${params.configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update AI model config' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update AI model config');
      }
      return payload as { config: AgentModelConfig | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-ai-agents', organizationId] });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'project-ai-agents' || query.queryKey[0] === 'admin-agent-control',
      });
    },
  });
}

export function useArchiveOrganizationAgentModelConfig(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/organizations/${organizationId}/ai-model-configs/${configId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to archive AI model config' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to archive AI model config');
      }
      return payload as { config: AgentModelConfig | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-ai-agents', organizationId] });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'project-ai-agents' || query.queryKey[0] === 'admin-agent-control',
      });
    },
  });
}

export function useProjectAgents(projectId: string | null) {
  return useQuery<ProjectAgentsResponse>({
    queryKey: ['project-ai-agents', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/agents`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch project AI agents' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch project AI agents');
      }
      return payload;
    },
    enabled: !!projectId,
  });
}

export function useUpdateProjectAgents(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/projects/${projectId}/agents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update project AI agents' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update project AI agents');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-ai-agents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useRunProjectAgent(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { kind: string; dryRun?: boolean }) => {
      const response = await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to run project agent' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to run project agent');
      }
      return payload as ProjectAgentRunResponse;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['project-ai-agents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });
}

export function useAdminAgentControl() {
  return useQuery<AdminAgentControlResponse>({
    queryKey: ['admin-agent-control'],
    queryFn: async () => {
      const response = await fetch('/api/admin/agent-control');
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch admin agent control' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch admin agent control');
      }
      return payload;
    },
  });
}

export function useUpdateAdminAgentControl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch('/api/admin/agent-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update admin agent control' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update admin agent control');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agent-control'] });
    },
  });
}

export function useProjectAgentStream(projectId: string | null, enabled = true) {
  return useAgentStream({
    url: projectId ? `/api/projects/${projectId}/agents/stream` : null,
    enabled: enabled && !!projectId,
    invalidateKeys: projectId
      ? [
          ['project-ai-agents', projectId],
          ['issues'],
          ['sprints', projectId],
        ]
      : [],
  });
}

export function useAdminAgentStream(enabled = true) {
  return useAgentStream({
    url: enabled ? '/api/admin/agent-control/stream' : null,
    enabled,
    invalidateKeys: [['admin-agent-control']],
  });
}
