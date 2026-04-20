import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input', () => {
  it('renders with a placeholder', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('fires onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Input placeholder="input" onChange={handleChange} />);
    await user.type(screen.getByPlaceholderText('input'), 'hi');
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports the disabled attribute', () => {
    render(<Input placeholder="disabled" disabled />);
    expect(screen.getByPlaceholderText('disabled')).toBeDisabled();
  });

  it('forwards the type attribute', () => {
    render(<Input placeholder="password" type="password" />);
    const input = screen.getByPlaceholderText('password');
    expect(input).toHaveAttribute('type', 'password');
  });
});
