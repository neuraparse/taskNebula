import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabelPicker } from '../label-picker';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('LabelPicker', () => {
  it('renders currently selected labels as badges', () => {
    render(
      <LabelPicker value={['frontend', 'urgent']} onChange={jest.fn()} />
    );

    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add label/i })).toBeInTheDocument();
  });

  it('removes a label when its X icon is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <LabelPicker value={['frontend', 'urgent']} onChange={onChange} />
    );

    const frontendBadge = screen.getByText('frontend');
    const removeButton = frontendBadge.parentElement?.querySelector('button');
    expect(removeButton).toBeTruthy();
    await user.click(removeButton as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(['urgent']);
  });

  it('adds a predefined label when clicked from the popover', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<LabelPicker value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const suggestion = await screen.findByText('bug');
    await user.click(suggestion);

    expect(onChange).toHaveBeenCalledWith(['bug']);
  });

  it('creates a custom label via the Add button', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<LabelPicker value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add label/i }));

    const input = await screen.findByPlaceholderText('Create new label...');
    await user.type(input, 'custom-tag');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(onChange).toHaveBeenCalledWith(['custom-tag']);
  });

  it('disables the Add label trigger when disabled', () => {
    render(<LabelPicker value={[]} onChange={jest.fn()} disabled />);

    expect(screen.getByRole('button', { name: /add label/i })).toBeDisabled();
  });
});
