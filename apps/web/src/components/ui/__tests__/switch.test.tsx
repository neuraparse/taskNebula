import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders with role=switch', () => {
    render(<Switch aria-label="notifications" />);
    expect(screen.getByRole('switch', { name: /notifications/i })).toBeInTheDocument();
  });

  it('fires onCheckedChange in controlled mode', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(
      <Switch
        aria-label="controlled-switch"
        checked={false}
        onCheckedChange={handleChange}
      />
    );
    await user.click(screen.getByRole('switch', { name: /controlled-switch/i }));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state via data-state', () => {
    render(<Switch aria-label="on-switch" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch', { name: /on-switch/i })).toHaveAttribute(
      'data-state',
      'checked'
    );
  });
});
