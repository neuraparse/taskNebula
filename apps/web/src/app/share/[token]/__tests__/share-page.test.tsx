import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Stub TipTap-based viewer so we don't need to spin up a real editor.
jest.mock('@/components/docs/document-content-viewer', () => ({
  DocumentContentViewer: ({ content }: { content: unknown }) => (
    <div data-testid="doc-content-viewer">{JSON.stringify(content ?? {})}</div>
  ),
}));

const getPublicDocumentByTokenMock = jest.fn();
jest.mock('@/lib/docs/server', () => ({
  getPublicDocumentByToken: (token: string) => getPublicDocumentByTokenMock(token),
}));

const notFoundMock = jest.fn(() => {
  // next/navigation.notFound throws a special error to trigger the 404 boundary
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

import PublicDocumentPage from '../page';

describe('PublicDocumentPage (shared doc view)', () => {
  beforeEach(() => {
    getPublicDocumentByTokenMock.mockReset();
    notFoundMock.mockClear();
  });

  it('renders the shared document with title, excerpt, and attachments', async () => {
    getPublicDocumentByTokenMock.mockResolvedValue({
      id: 'doc-1',
      title: 'Public Design Doc',
      slug: 'design-doc',
      excerpt: 'A public summary of the design.',
      updatedAt: '2025-03-01T12:00:00.000Z',
      publishedAt: '2025-03-01T12:00:00.000Z',
      allowSearchIndexing: true,
      includeAttachments: true,
      contentJson: { type: 'doc', content: [] },
      attachments: [
        {
          id: 'att-1',
          fileName: 'brief.pdf',
          fileSize: 1234,
          mimeType: 'application/pdf',
          publicUrl: '/api/public/docs/tok/assets/att-1',
        },
      ],
    });

    const ui = await PublicDocumentPage({
      params: Promise.resolve({ token: 'tok' }),
    });
    render(ui);

    expect(
      screen.getByRole('heading', { level: 1, name: /public design doc/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/a public summary of the design/i)).toBeInTheDocument();
    expect(screen.getByTestId('doc-content-viewer')).toBeInTheDocument();
    expect(screen.getByText(/brief\.pdf/)).toBeInTheDocument();
    expect(getPublicDocumentByTokenMock).toHaveBeenCalledWith('tok');
  });

  it('calls notFound() when the share token is invalid or disabled', async () => {
    getPublicDocumentByTokenMock.mockResolvedValue(null);

    await expect(
      PublicDocumentPage({ params: Promise.resolve({ token: 'bad-token' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getPublicDocumentByTokenMock).toHaveBeenCalledWith('bad-token');
  });
});
