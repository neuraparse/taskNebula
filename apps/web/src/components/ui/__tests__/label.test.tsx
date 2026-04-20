import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  it('renders its text content', () => {
    render(<Label>Email address</Label>);
    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  it('forwards the htmlFor attribute', () => {
    render(<Label htmlFor="email-field">Email</Label>);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'email-field');
  });

  it('associates with an input via htmlFor', () => {
    render(
      <>
        <Label htmlFor="my-input">My Label</Label>
        <input id="my-input" />
      </>
    );
    expect(screen.getByLabelText('My Label')).toBeInTheDocument();
  });
});
