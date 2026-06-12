import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useLabelsMock = jest.fn();
jest.mock('@/lib/hooks/use-labels', () => ({
  useLabels: (...args: unknown[]) => useLabelsMock(...args),
}));

import { LabelPicker } from '../label-picker';

const orgLabels = [
  { name: 'backend', color: '#3B82F6' },
  { name: 'bug', color: '#EF4444' },
  { name: 'frontend', color: '#10B981' },
];

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

beforeEach(() => {
  useLabelsMock.mockReset();
  useLabelsMock.mockReturnValue({ data: orgLabels, isLoading: false });
});

describe('LabelPicker', () => {
  it('renders currently selected labels as chips', () => {
    render(
      <LabelPicker
        value={['frontend', 'urgent']}
        onChange={jest.fn()}
        organizationId="org-1"
        projectId="project-1"
      />
    );

    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add label/i })).toBeInTheDocument();
  });

  it('removes a label when its X icon is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <LabelPicker value={['frontend', 'urgent']} onChange={onChange} organizationId="org-1" />
    );

    await user.click(screen.getByRole('button', { name: 'Remove label frontend' }));

    expect(onChange).toHaveBeenCalledWith(['urgent']);
  });

  it('adds an existing org label from the autocomplete dropdown', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <LabelPicker value={[]} onChange={onChange} organizationId="org-1" projectId="project-1" />
    );

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const suggestion = await screen.findByText('bug');
    await user.click(suggestion);

    expect(onChange).toHaveBeenCalledWith(['bug']);
  });

  it('offers create-on-select for a name that matches no existing label', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<LabelPicker value={[]} onChange={onChange} organizationId="org-1" />);

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const input = await screen.findByPlaceholderText('Search or create labels…');
    await user.type(input, 'custom-tag');

    const createItem = await screen.findByText('Create "custom-tag"');
    await user.click(createItem);

    expect(onChange).toHaveBeenCalledWith(['custom-tag']);
  });

  it('does not offer create for an exact existing-label match', async () => {
    const user = userEvent.setup();

    render(<LabelPicker value={[]} onChange={jest.fn()} organizationId="org-1" />);

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const input = await screen.findByPlaceholderText('Search or create labels…');
    await user.type(input, 'bug');

    expect(screen.queryByText('Create "bug"')).not.toBeInTheDocument();
  });

  it('falls back to static suggestions when no organization is provided', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<LabelPicker value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const suggestion = await screen.findByText('documentation');
    await user.click(suggestion);

    expect(onChange).toHaveBeenCalledWith(['documentation']);
  });

  it('disables the Add label trigger when disabled', () => {
    render(<LabelPicker value={[]} onChange={jest.fn()} disabled organizationId="org-1" />);

    expect(screen.getByRole('button', { name: /add label/i })).toBeDisabled();
  });
});
