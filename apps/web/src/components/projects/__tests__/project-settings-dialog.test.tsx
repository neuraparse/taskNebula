import { render, screen } from '@testing-library/react';
import { ProjectSettingsDialog } from '../project-settings-dialog';

const mockProjectSettingsContent = jest.fn(
  ({ projectId, variant }: { projectId: string; variant?: 'page' | 'dialog' }) => (
    <div data-project-id={projectId} data-testid="settings-content" data-variant={variant} />
  )
);

jest.mock('../project-settings-content', () => ({
  ProjectSettingsContent: (props: { projectId: string; variant?: 'page' | 'dialog' }) =>
    mockProjectSettingsContent(props),
}));

describe('ProjectSettingsDialog', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders project settings in the dialog variant with a full-page shortcut', () => {
    render(<ProjectSettingsDialog projectId="proj-1" open onOpenChange={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: /project settings/i })).toBeInTheDocument();
    expect(
      screen.getByText(/configure permissions, workflows, custom fields, and integrations/i)
    ).toBeInTheDocument();

    const fullPageLink = screen.getByRole('link', { name: /open full page/i });
    expect(fullPageLink).toHaveAttribute('href', '/projects/proj-1/settings');
    expect(screen.getByTestId('settings-content')).toHaveAttribute('data-project-id', 'proj-1');
    expect(screen.getByTestId('settings-content')).toHaveAttribute('data-variant', 'dialog');
  });
});
