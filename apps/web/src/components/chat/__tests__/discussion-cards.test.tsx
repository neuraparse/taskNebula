import { render, screen } from '@testing-library/react';
import { ApiResponseError } from '@/lib/client-api-errors';
import { DocumentDiscussionCard } from '../document-discussion-card';
import { IssueDiscussionCard } from '../issue-discussion-card';

let issueConversationResult: {
  data?: unknown;
  isLoading: boolean;
  error?: unknown;
};
let documentConversationResult: {
  data?: unknown;
  isLoading: boolean;
  error?: unknown;
};

jest.mock('@/lib/hooks/use-chat', () => ({
  useIssueConversation: () => issueConversationResult,
  useDocumentConversation: () => documentConversationResult,
}));

describe('discussion preview cards', () => {
  beforeEach(() => {
    issueConversationResult = { data: undefined, isLoading: false, error: undefined };
    documentConversationResult = { data: undefined, isLoading: false, error: undefined };
  });

  it('shows a localized access message for issue conversation permission errors', () => {
    issueConversationResult = {
      data: undefined,
      isLoading: false,
      error: new ApiResponseError('You do not have permission to view project chat.', 403),
    };

    render(<IssueDiscussionCard issueId="issue-1" projectId="project-1" />);

    expect(screen.getByText("You don't have permission to view that page.")).toBeInTheDocument();
    expect(
      screen.queryByText('You do not have permission to view project chat.')
    ).not.toBeInTheDocument();
  });

  it('shows a localized access message for document conversation permission errors', () => {
    documentConversationResult = {
      data: undefined,
      isLoading: false,
      error: new ApiResponseError('You do not have permission to view project chat.', 403),
    };

    render(<DocumentDiscussionCard pageId="page-1" projectId="project-1" />);

    expect(screen.getByText("You don't have permission to view that page.")).toBeInTheDocument();
    expect(
      screen.queryByText('You do not have permission to view project chat.')
    ).not.toBeInTheDocument();
  });
});
