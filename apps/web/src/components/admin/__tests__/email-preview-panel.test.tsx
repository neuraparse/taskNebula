import { render, screen, waitFor } from '@testing-library/react';
import { EmailPreviewPanel } from '../email-preview-panel';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe('EmailPreviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads preview HTML into iframe srcdoc instead of framing the API route', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html><body><strong>Hello preview</strong></body></html>'),
    });
    global.fetch = fetchMock;

    render(<EmailPreviewPanel />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/email-preview?template=verify_email',
        expect.objectContaining({ credentials: 'same-origin' })
      );
    });

    const iframe = await screen.findByTitle('Email preview: Verify email');
    expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Hello preview'));
    expect(iframe).not.toHaveAttribute('src');
  });
});
