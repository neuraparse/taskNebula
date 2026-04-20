import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../checkbox';

describe('Checkbox', () => {
  it('is unchecked initially and flips on click (uncontrolled)', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="accept" />);
    const checkbox = screen.getByRole('checkbox', { name: /accept/i });
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('fires onCheckedChange in controlled mode', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(
      <Checkbox aria-label="controlled" checked={false} onCheckedChange={handleChange} />
    );
    await user.click(screen.getByRole('checkbox', { name: /controlled/i }));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('renders as checked when checked=true', () => {
    render(<Checkbox aria-label="on" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /on/i })).toHaveAttribute(
      'data-state',
      'checked'
    );
  });
});
