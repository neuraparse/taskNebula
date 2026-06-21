import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiTransparencyClient } from '../ai-transparency-client';

const mockUseOrganizationAgentSettings = jest.fn();
const mockMutateAsync = jest.fn();
const mockToast = jest.fn();

jest.mock('@/lib/hooks/use-agents', () => ({
  useOrganizationAgentSettings: (organizationId: string) =>
    mockUseOrganizationAgentSettings(organizationId),
  useUpdateOrganizationAgentSettings: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const BASE_DATA = {
  organizationId: 'org-1',
  organizationName: 'Acme',
  access: {
    canManage: true,
  },
  workspaceSettings: {
    assistantEnabled: false,
    enabled: false,
    modelConfigId: null,
    provider: 'openai',
    model: 'gpt-4o-mini',
    executionMode: 'manual',
    allowWriteActions: false,
    requireApprovalForWrites: true,
    aiOversight: 'review_required',
    aiSafetyMode: 'warn',
    dailyRunLimit: 20,
    capabilities: {
      project_tracking: false,
      backlog_triage: true,
      sprint_planning: false,
      bulk_sprint_creation: false,
    },
  },
};

describe('AiTransparencyClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
    mockUseOrganizationAgentSettings.mockReturnValue({
      data: BASE_DATA,
      isLoading: false,
      error: null,
    });
  });

  it('persists oversight posture through the organization AI agents API mutation', async () => {
    const user = userEvent.setup();

    render(<AiTransparencyClient organizationId="org-1" />);

    await user.click(screen.getByTestId('ai-oversight-toggle'));

    expect(mockMutateAsync).toHaveBeenCalledWith({ aiOversight: 'auto' });
  });

  it('persists assistant-backed feature toggles through assistantEnabled', async () => {
    const user = userEvent.setup();

    render(<AiTransparencyClient organizationId="org-1" />);

    await user.click(screen.getByRole('switch', { name: /Draft Issue/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ assistantEnabled: true });
  });

  it('persists backlog triage through the real agent capability', async () => {
    const user = userEvent.setup();

    render(<AiTransparencyClient organizationId="org-1" />);

    await user.click(screen.getByRole('switch', { name: /Backlog Triage/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      capabilities: { backlog_triage: false },
    });
  });

  it('does not offer a fake toggle when no persisted feature setting exists', () => {
    render(<AiTransparencyClient organizationId="org-1" />);

    expect(screen.getByRole('switch', { name: /Semantic Search Embeddings/i })).toBeDisabled();
  });
});
