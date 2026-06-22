import { useEffect, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteTransition } from '../route-transition';

let mockPathname = '/dashboard';
let mountCount = 0;

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function StatefulChild() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    mountCount += 1;
  }, []);

  return (
    <button type="button" onClick={() => setCount((current) => current + 1)}>
      Count {count}
    </button>
  );
}

describe('RouteTransition', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    mountCount = 0;
  });

  it('does not remount the page tree when the pathname changes', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <RouteTransition>
        <StatefulChild />
      </RouteTransition>
    );

    await user.click(screen.getByRole('button', { name: /count 0/i }));
    expect(screen.getByRole('button', { name: /count 1/i })).toBeInTheDocument();

    mockPathname = '/projects';
    rerender(
      <RouteTransition>
        <StatefulChild />
      </RouteTransition>
    );

    expect(screen.getByRole('button', { name: /count 1/i })).toBeInTheDocument();
    expect(mountCount).toBe(1);
    expect(container.firstElementChild).not.toHaveClass('animate-page-enter');
  });
});
