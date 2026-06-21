import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUpForm } from '../signup-form';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const replaceMock = jest.fn();
const signInMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const fetchMock = jest.fn();

function mockFetchResponse(url: string) {
  if (url === '/api/setup') {
    return Promise.resolve({
      ok: true,
      json: async () => ({ setupRequired: false }),
    });
  }
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/auth/signup');
  fetchMock.mockImplementation((url: string) => {
    const setup = mockFetchResponse(url);
    if (setup) return setup;
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('SignUpForm', () => {
  it('renders name, email, password inputs and a submit button', async () => {
    render(<SignUpForm />);

    expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('hides OAuth buttons when no login provider is configured', async () => {
    render(<SignUpForm />);

    expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/or continue with email/i)).not.toBeInTheDocument();
  });

  it('renders configured OAuth providers and preserves the project invite callback', async () => {
    window.history.pushState({}, '', '/auth/signup?projectInviteToken=project-token-1');
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/setup') {
        return Promise.resolve({ ok: true, json: async () => ({ setupRequired: false }) });
      }
      if (url === '/api/auth/oauth-providers') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ providers: { github: false, google: true } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    const googleButton = await screen.findByRole('button', { name: /continue with google/i });
    expect(screen.queryByRole('button', { name: /continue with github/i })).not.toBeInTheDocument();
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();

    await user.click(googleButton);

    expect(signInMock).toHaveBeenCalledWith('google', {
      callbackUrl: '/join/project/project-token-1',
    });
  });

  it('POSTs to /api/auth/signup with valid input then auto-signs-in', async () => {
    signInMock.mockResolvedValue({ ok: true, error: null });
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/setup') {
        return Promise.resolve({ ok: true, json: async () => ({ setupRequired: false }) });
      }
      if (url === '/api/auth/signup') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ message: 'User created successfully' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(await screen.findByLabelText(/full name/i), 'Alice');
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'hunter2hunter2',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        redirect: false,
      });
    });
  });

  it('prefills invite email and sends invite token with normalized signup email', async () => {
    window.history.pushState(
      {},
      '',
      '/auth/signup?email=Invited%40Example.COM&token=invite-token-1'
    );
    signInMock.mockResolvedValue({ ok: true, error: null });

    const user = userEvent.setup();
    render(<SignUpForm />);

    const emailInput = await screen.findByLabelText(/email address/i);
    await waitFor(() => expect(emailInput).toHaveValue('invited@example.com'));

    await user.type(await screen.findByLabelText(/full name/i), 'Invited User');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Invited User',
            email: 'invited@example.com',
            password: 'hunter2hunter2',
            inviteToken: 'invite-token-1',
          }),
        })
      );
    });

    expect(signInMock).toHaveBeenCalledWith('credentials', {
      email: 'invited@example.com',
      password: 'hunter2hunter2',
      redirect: false,
    });
    expect(pushMock).toHaveBeenCalledWith('/auth/verify-request?email=invited%40example.com');
  });

  it('shows the server error on failed signup', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/setup') {
        return Promise.resolve({ ok: true, json: async () => ({ setupRequired: false }) });
      }
      if (url === '/api/auth/signup') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Email already in use' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(await screen.findByLabelText(/full name/i), 'Alice');
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email already in use/i);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('maps registration policy error codes to localized messages', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/setup') {
        return Promise.resolve({ ok: true, json: async () => ({ setupRequired: false }) });
      }
      if (url === '/api/auth/signup') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            error: 'REGISTRATION_INVITE_REQUIRED',
            code: 'REGISTRATION_INVITE_REQUIRED',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(await screen.findByLabelText(/full name/i), 'Alice');
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invitation/i);
    expect(signInMock).not.toHaveBeenCalled();
  });
});
