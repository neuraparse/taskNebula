import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  it('renders with a placeholder', () => {
    render(<Textarea placeholder="Write here" />);
    expect(screen.getByPlaceholderText('Write here')).toBeInTheDocument();
  });

  it('fires onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Textarea placeholder="area" onChange={handleChange} />);
    await user.type(screen.getByPlaceholderText('area'), 'hello');
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports the rows attribute', () => {
    render(<Textarea placeholder="rows" rows={8} />);
    expect(screen.getByPlaceholderText('rows')).toHaveAttribute('rows', '8');
  });

  it('supports the disabled attribute', () => {
    render(<Textarea placeholder="disabled" disabled />);
    expect(screen.getByPlaceholderText('disabled')).toBeDisabled();
  });
});
