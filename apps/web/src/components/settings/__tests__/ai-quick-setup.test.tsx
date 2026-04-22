import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiQuickSetup } from '../ai-quick-setup';
import type { WorkspaceAgentSettings } from '@/lib/agents/config';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'QC';
  return Wrapper;
}

const BASE_SETTINGS: WorkspaceAgentSettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  modelConfigId: null,
  assistantEnabled: false,
  enabled: false,
  executionMode: 'manual',
  allowWriteActions: false,
  requireApprovalForWrites: true,
  dailyRunLimit: 20,
  capabilities: {
    project_tracking: false,
    backlog_triage: false,
    sprint_planning: false,
    bulk_sprint_creation: false,
  },
};

describe('AiQuickSetup', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders with provider + model auto-filled from workspace settings', () => {
    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={BASE_SETTINGS}
        providerConfigured={false}
        providerSource={null}
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    expect(screen.getByText(/Quick setup/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable AI Assistant/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
  });

  it('shows "Active" badge when assistantEnabled + provider matches + credential configured', () => {
    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={{ ...BASE_SETTINGS, assistantEnabled: true }}
        providerConfigured={true}
        providerSource="workspace"
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update/i })).toBeInTheDocument();
  });

  it('hides API key input when workspace provider is native', () => {
    // Mounting with provider=native up front. The provider→native toggle
    // via Radix Select is exercised in e2e — jsdom can't animate the
    // Radix portal reliably, so we test the rendered state here.
    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={{
          ...BASE_SETTINGS,
          provider: 'native',
          model: 'tasknebula-planner-v1',
        }}
        providerConfigured={true}
        providerSource="server_env"
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument();
  });

  it('disables submit when canManage is false', () => {
    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={BASE_SETTINGS}
        providerConfigured={true}
        providerSource="platform"
        canManage={false}
      />,
      { wrapper: makeWrapper() }
    );

    const button = screen.getByRole('button', { name: /Enable AI Assistant/i });
    expect(button).toBeDisabled();
  });

  it('disables submit when no credential configured AND user provides no key', () => {
    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={BASE_SETTINGS}
        providerConfigured={false}
        providerSource={null}
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    const button = screen.getByRole('button', { name: /Enable AI Assistant/i });
    expect(button).toBeDisabled();
  });

  it('submits PATCH with assistantEnabled + provider + model + credential', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceSettings: { ...BASE_SETTINGS, assistantEnabled: true } }),
    });
    global.fetch = fetchMock as any;
    const user = userEvent.setup();

    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={BASE_SETTINGS}
        providerConfigured={false}
        providerSource={null}
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    await user.type(screen.getByLabelText(/API key/i), 'sk-test-123456789012345');
    await user.click(screen.getByRole('button', { name: /Enable AI Assistant/i }));

    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizations/org-1/ai-agents',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"assistantEnabled":true'),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.credential).toEqual({ provider: 'openai', apiKey: 'sk-test-123456789012345' });
  });

  it('omits credential from PATCH when user leaves key empty and platform has one', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceSettings: BASE_SETTINGS }),
    });
    global.fetch = fetchMock as any;
    const user = userEvent.setup();

    render(
      <AiQuickSetup
        organizationId="org-1"
        workspaceSettings={BASE_SETTINGS}
        providerConfigured={true}
        providerSource="platform"
        canManage={true}
      />,
      { wrapper: makeWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /Enable AI Assistant/i }));
    await new Promise((r) => setTimeout(r, 10));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.credential).toBeUndefined();
    expect(body.assistantEnabled).toBe(true);
  });
});
