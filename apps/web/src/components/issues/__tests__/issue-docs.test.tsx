import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiResponseError } from '@/lib/client-api-errors';
import { IssueDocs } from '../issue-docs';

const pushMock = jest.fn();
const toastMock = jest.fn();
const attachMutateAsyncMock = jest.fn();
const detachMutateAsyncMock = jest.fn();

let issueDocsResult: {
  data?: unknown[];
  isLoading: boolean;
  error?: unknown;
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-1' }),
}));

jest.mock('@/lib/hooks/use-docs', () => ({
  useIssueDocs: () => issueDocsResult,
  useAttachIssueDoc: () => ({ mutateAsync: attachMutateAsyncMock, isPending: false }),
  useDetachIssueDoc: () => ({ mutateAsync: detachMutateAsyncMock, isPending: false }),
  useDocumentSearch: () => ({ data: [] }),
}));

function renderIssueDocs() {
  return render(
    <IssueDocs
      issueId="issue-1"
      issueKey="NEB-1"
      issueTitle="Restricted issue"
      projectId="project-1"
    />
  );
}

describe('IssueDocs', () => {
  beforeEach(() => {
    pushMock.mockReset();
    toastMock.mockReset();
    attachMutateAsyncMock.mockReset();
    detachMutateAsyncMock.mockReset();
    issueDocsResult = { data: [], isLoading: false };
  });

  it('shows a localized access message instead of the empty state on permission errors', () => {
    issueDocsResult = {
      data: undefined,
      isLoading: false,
      error: new ApiResponseError('Forbidden', 403),
    };

    renderIssueDocs();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "You don't have permission to view that page."
    );
    expect(screen.queryByText(/No docs linked yet/i)).not.toBeInTheDocument();
  });

  it('uses the localized access message when spec doc creation is denied', async () => {
    attachMutateAsyncMock.mockRejectedValue(
      new ApiResponseError('You do not have permission to create docs in this space', 403)
    );

    renderIssueDocs();

    fireEvent.click(screen.getByRole('button', { name: /create spec/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You don't have permission to view that page.",
          variant: 'destructive',
        })
      );
    });

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'You do not have permission to create docs in this space',
      })
    );
  });
});
