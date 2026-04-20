import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssigneePicker } from '../assignee-picker';
import { useOrganizationMembers } from '@/lib/hooks/use-members';

jest.mock('@/lib/hooks/use-members', () => ({
  useOrganizationMembers: jest.fn(),
}));

const mockUseOrganizationMembers =
  useOrganizationMembers as jest.MockedFunction<typeof useOrganizationMembers>;

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const members = [
  {
    id: 'user-1',
    name: 'Alice Example',
    email: 'alice@example.com',
    image: null,
    status: 'active',
    role: 'owner' as const,
    memberStatus: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'user-2',
    name: 'Bob Example',
    email: 'bob@example.com',
    image: null,
    status: 'active',
    role: 'member' as const,
    memberStatus: 'active',
    joinedAt: new Date().toISOString(),
  },
];

beforeEach(() => {
  mockUseOrganizationMembers.mockReturnValue({
    data: { members, userRole: 'owner', isSuperAdmin: false },
    isLoading: false,
  } as ReturnType<typeof useOrganizationMembers>);
});

describe('AssigneePicker', () => {
  it('renders Unassigned placeholder when value is null', () => {
    render(
      <Wrapper>
        <AssigneePicker organizationId="org-1" value={null} onChange={jest.fn()} />
      </Wrapper>
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Unassigned');
  });

  it('renders the selected member name', () => {
    render(
      <Wrapper>
        <AssigneePicker organizationId="org-1" value="user-2" onChange={jest.fn()} />
      </Wrapper>
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Bob Example');
  });

  it('emits the selected user id when a member is chosen', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <Wrapper>
        <AssigneePicker organizationId="org-1" value={null} onChange={onChange} />
      </Wrapper>
    );

    await user.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: /alice example/i });
    await user.click(option);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('user-1');
    });
  });

  it('emits null when Unassigned is chosen', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <Wrapper>
        <AssigneePicker organizationId="org-1" value="user-1" onChange={onChange} />
      </Wrapper>
    );

    await user.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: /unassigned/i });
    await user.click(option);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
