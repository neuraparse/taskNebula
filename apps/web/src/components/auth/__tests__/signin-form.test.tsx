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

  it('renders the verified success banner when ?verified=1 is present', async () => {
    searchParamsValue = new URLSearchParams('verified=1');
    render(<SignInForm />);

    expect(
      await screen.findByText(/email verified\. sign in to continue\./i)
    ).toBeInTheDocument();
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
