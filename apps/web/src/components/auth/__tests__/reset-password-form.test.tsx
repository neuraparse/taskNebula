import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/auth/reset-password/page';
import { ResetPasswordForm } from '../reset-password-form';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ResetPasswordForm', () => {
  it('renders new password and confirm password inputs with submit button', () => {
    render(<ResetPasswordForm token="tok_abc" />);

    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('POSTs to /api/auth/reset-password with token and newPassword on valid submit', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Password updated successfully' }),
    });

    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok_abc" />);

    await user.type(screen.getByLabelText(/^new password$/i), 'newpass1234');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass1234');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'tok_abc', newPassword: 'newpass1234' }),
        })
      );
    });

    // Success state renders
    expect(await screen.findByRole('heading', { name: /password reset/i })).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match without calling fetch', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok_abc" />);

    await user.type(screen.getByLabelText(/^new password$/i), 'newpass1234');
    await user.type(screen.getByLabelText(/confirm password/i), 'different123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/passwords do not match/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a localized reset error when the endpoint rejects the token', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid or expired token' }),
    });

    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok_bad" />);

    await user.type(screen.getByLabelText(/^new password$/i), 'newpass1234');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass1234');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/failed to reset password/i);
  });

  it('redirects to /auth/signin?reset=1 after a successful reset', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Password updated successfully' }),
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ResetPasswordForm token="tok_abc" />);

    await user.type(screen.getByLabelText(/^new password$/i), 'newpass1234');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass1234');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    // Wait for success UI to appear before advancing timers.
    await screen.findByRole('heading', { name: /password reset/i });

    act(() => {
      jest.advanceTimersByTime(2100);
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/auth/signin?reset=1');
    });
  });

  it('shows "Request a new reset link" when the page is rendered without a token', async () => {
    const ui = await ResetPasswordPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(screen.getByRole('heading', { name: /invalid reset link/i })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /request a new reset link/i });
    expect(link).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('shows validation error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok_abc" />);

    // Bypass native minLength so the submit handler runs its own check.
    const newPasswordInput = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
    newPasswordInput.removeAttribute('minLength');
    confirmPasswordInput.removeAttribute('minLength');

    await user.type(newPasswordInput, 'short1');
    await user.type(confirmPasswordInput, 'short1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/at least 8 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
