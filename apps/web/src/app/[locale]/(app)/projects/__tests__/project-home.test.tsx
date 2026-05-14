/**
 * /projects/[projectId]/page.tsx is a pure server-side redirect to
 * `/projects/[projectId]/views`. This test verifies the redirect target
 * so a future regression (blank page, "coming soon", wrong URL) fails here.
 */
import ProjectPage from '../[projectId]/page';

const redirectMock = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

jest.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe('ProjectPage (pure redirect)', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects /projects/:id to /projects/:id/views', async () => {
    await expect(
      ProjectPage({ params: Promise.resolve({ projectId: 'alpha' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/projects/alpha/views');

    expect(redirectMock).toHaveBeenCalledWith('/projects/alpha/views');
  });

  it('preserves the project key/id exactly in the redirect URL', async () => {
    await expect(
      ProjectPage({ params: Promise.resolve({ projectId: 'TN-CORE' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/projects/TN-CORE/views');
  });
});
