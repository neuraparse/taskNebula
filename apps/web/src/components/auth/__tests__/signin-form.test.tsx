import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInForm } from '../signin-form';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const replaceMock = jest.fn();
const signInMock = jest.fn();

let searchParamsValue = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: replaceMock,
  }),
  useSearchParams: () => searchParamsValue,
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

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsValue = new URLSearchParams();
  // /api/setup returns setupRequired:false so the form renders
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ setupRequired: false }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('SignInForm', () => {
  it('renders email, password inputs and a sign-in button', async () => {
    render(<SignInForm />);

    // Wait for setup-check spinner to resolve
    expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('hides OAuth buttons when no login provider is configured', async () => {
    render(<SignInForm />);

    expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/or continue with email/i)).not.toBeInTheDocument();
  });

  it('renders only configured OAuth providers and keeps the project invite callback', async () => {
    searchParamsValue = new URLSearchParams('projectInviteToken=invite-token-1');
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/setup') {
        return Promise.resolve({ ok: true, json: async () => ({ setupRequired: false }) });
      }
      if (url === '/api/auth/oauth-providers') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ providers: { github: true, google: false } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    render(<SignInForm />);

    const githubButton = await screen.findByRole('button', { name: /continue with github/i });
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();

    await user.click(githubButton);

    expect(signInMock).toHaveBeenCalledWith('github', {
      callbackUrl: '/join/project/invite-token-1',
    });
  });

  it('calls next-auth signIn with credentials on valid submit', async () => {
    signInMock.mockResolvedValue({ ok: true, error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(await screen.findByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('uses a safe callbackUrl after credentials sign-in', async () => {
    searchParamsValue = new URLSearchParams(
      'callbackUrl=/settings/import%3Fsource%3Dplane%26projectId%3Dproject-1'
    );
    signInMock.mockResolvedValue({ ok: true, error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(await screen.findByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/settings/import?source=plane&projectId=project-1');
    });
  });

  it('renders the verified success banner when ?verified=1 is present', async () => {
    searchParamsValue = new URLSearchParams('verified=1');
    render(<SignInForm />);

    expect(await screen.findByText(/email verified\. sign in to continue\./i)).toBeInTheDocument();
  });

  it('shows an error message when signIn returns an error', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(await screen.findByLabelText(/email address/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
