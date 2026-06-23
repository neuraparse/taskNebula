import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyRequestResendButton } from '../verify-request-resend-button';

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('VerifyRequestResendButton', () => {
  it('renders the initial resend button', () => {
    render(<VerifyRequestResendButton />);
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });

  it('POSTs to /api/auth/send-verification and shows the sent state', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const user = userEvent.setup();
    render(<VerifyRequestResendButton />);

    await user.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/send-verification',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(await screen.findByRole('button', { name: /email sent/i })).toBeDisabled();
    expect(screen.getByText(/check your inbox for the new link/i)).toBeInTheDocument();
  });

  it('shows a localized send error on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Rate limited' }),
    });

    const user = userEvent.setup();
    render(<VerifyRequestResendButton />);

    await user.click(screen.getByRole('button', { name: /resend verification email/i }));

    expect(await screen.findByText(/failed to send verification email/i)).toBeInTheDocument();
  });
});
