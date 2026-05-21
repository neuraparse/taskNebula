import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replaceMock = jest.fn();
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

import SetupPage from '../page';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
  replaceMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function mockSetupGet(setupRequired: boolean) {
  fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
    const path = typeof url === 'string' ? url : url.toString();
    if (path === '/api/setup') {
      return {
        ok: true,
        json: async () => ({ setupRequired }),
      } as unknown as Response;
    }
    return { ok: true, json: async () => ({}) } as unknown as Response;
  });
}

describe('SetupPage', () => {
  it('redirects to sign-in when setup is already completed', async () => {
    mockSetupGet(false);

    render(<SetupPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/auth/signin');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/setup');
  });

  it('renders the admin create form when setup is required', async () => {
    mockSetupGet(true);

    render(<SetupPage />);

    expect(
      await screen.findByRole('heading', { name: /welcome to tasknebula/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create admin account/i })).toBeInTheDocument();
  });

  it('shows an error when passwords do not match', async () => {
    mockSetupGet(true);

    const user = userEvent.setup();
    render(<SetupPage />);

    await user.type(await screen.findByLabelText(/full name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'different2');
    await user.click(screen.getByRole('button', { name: /create admin account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
    // POST /api/setup should NOT fire when validation fails client-side
    const postCalls = fetchMock.mock.calls.filter(
      (call) => call[1] && (call[1] as RequestInit).method === 'POST'
    );
    expect(postCalls).toHaveLength(0);
  });

  it('submits credentials and shows success state on successful POST', async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ setupRequired: true }),
      } as unknown as Response;
    });

    const user = userEvent.setup();
    render(<SetupPage />);

    await user.type(await screen.findByLabelText(/full name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'password1');
    await user.click(screen.getByRole('button', { name: /create admin account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/setup',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await user.click(await screen.findByRole('button', { name: /skip \/ start blank/i }));
    expect(await screen.findByText(/setup complete/i)).toBeInTheDocument();
  });
});
