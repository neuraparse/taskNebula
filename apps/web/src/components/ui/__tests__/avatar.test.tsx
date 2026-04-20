import { render, screen } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarImage } from '../avatar';

describe('Avatar', () => {
  it('renders the fallback text when no image is provided', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders the fallback when the image has not loaded', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/nope.png" alt="user avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders an Avatar root element', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>XY</AvatarFallback>
      </Avatar>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
