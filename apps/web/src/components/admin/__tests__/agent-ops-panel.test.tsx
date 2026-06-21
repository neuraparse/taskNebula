import { render, screen } from '@testing-library/react';
import { AgentOpsPanel } from '../agent-ops-panel';

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, 'aria-label': ariaLabel }: { checked?: boolean; 'aria-label'?: string }) => (
    <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} />
  ),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-test' }),
}));

const mockAgentControlData = {
  settings: {
    globalEnabled: true,
    allowWriteActions: true,
    requireSupervisionForAutoMode: true,
    maxConcurrentRuns: 6,
  },
  stats: {
    enabledWorkspaceCount: 1,
    enabledProjectCount: 2,
    runningRuns: 0,
    failedRuns: 0,
    readyWorkspaceCount: 1,
    blockedWorkspaceCount: 0,
  },
  serviceStatus: [],
  providerBreakdown: {},
  workspaceCoverage: [],
  recentRuns: [],
};

const mockAgentStream = {
  isConnected: false,
  lastEventAt: null,
  liveRuns: [],
};

jest.mock('@/lib/hooks/use-agents', () => ({
  useAdminAgentControl: () => ({
    data: mockAgentControlData,
    isLoading: false,
    error: null,
  }),
  useAdminAgentStream: () => mockAgentStream,
  useUpdateAdminAgentControl: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('../platform-ai-credentials', () => ({
  PlatformAiCredentials: () => <div data-testid="platform-ai-credentials" />,
}));

jest.mock('@/components/settings/agent-governance-panel', () => ({
  AgentGovernancePanel: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="agent-governance-panel" data-organization-id={organizationId} />
  ),
}));

describe('AgentOpsPanel', () => {
  it('surfaces the agent governance approval queue in Admin > Agent control', () => {
    render(<AgentOpsPanel />);

    const panel = screen.getByTestId('agent-governance-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-organization-id', 'org-test');
  });
});
