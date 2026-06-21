import { fireEvent, render, screen } from '@testing-library/react';
import { AppHeader } from '../app-header';
import { useCommandPalette } from '@/lib/command/use-command-palette';

jest.mock('@/components/organization/organization-switcher', () => ({
  OrganizationSwitcher: () => <div data-testid="organization-switcher" />,
}));

jest.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

jest.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
}));

jest.mock('@/lib/command/use-command-palette', () => ({
  useCommandPalette: jest.fn(),
}));

const mockUseCommandPalette = useCommandPalette as jest.MockedFunction<typeof useCommandPalette>;

describe('AppHeader', () => {
  beforeEach(() => {
    mockUseCommandPalette.mockReturnValue({
      open: jest.fn(),
      close: jest.fn(),
      setOpen: jest.fn(),
      isOpen: false,
    });
  });

  it('keeps desktop account access out of the top header', () => {
    render(<AppHeader />);

    expect(screen.getByTestId('organization-switcher')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
  });

  it('opens the command palette from the search trigger', () => {
    const open = jest.fn();
    mockUseCommandPalette.mockReturnValue({
      open,
      close: jest.fn(),
      setOpen: jest.fn(),
      isOpen: false,
    });

    render(<AppHeader />);

    fireEvent.click(screen.getByRole('button', { name: /open command palette/i }));
    expect(open).toHaveBeenCalled();
  });

  it('hides workspace controls when the user has no workspace access', () => {
    render(<AppHeader hasWorkspaceAccess={false} />);

    expect(screen.queryByTestId('organization-switcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open command palette/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument();
  });
});
