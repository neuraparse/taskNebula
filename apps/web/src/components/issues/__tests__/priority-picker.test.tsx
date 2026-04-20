import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PriorityPicker } from '../priority-picker';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('PriorityPicker', () => {
  it('renders the currently selected priority label', () => {
    render(<PriorityPicker value="high" onChange={jest.fn()} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('High');
  });

  it('falls back to a default when the value is unknown', () => {
    render(<PriorityPicker value="unknown" onChange={jest.fn()} />);

    // priorities[4] == None
    expect(screen.getByRole('combobox')).toHaveTextContent('None');
  });

  it('disables the trigger when disabled is true', () => {
    render(<PriorityPicker value="low" onChange={jest.fn()} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('opens and emits the new value when a priority is selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<PriorityPicker value="low" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));

    // Command options become available
    const option = await screen.findByRole('option', { name: /critical/i });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith('critical');
  });
});
