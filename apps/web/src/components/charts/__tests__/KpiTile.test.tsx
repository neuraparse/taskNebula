import { render } from '@testing-library/react';
import { KpiTile } from '../KpiTile';

// Recharts touches ResizeObserver which jsdom doesn't ship — stub it so the
// component can mount during snapshot tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  // @ts-expect-error jsdom global augmentation
  global.ResizeObserver = ResizeObserverStub;
});

describe('KpiTile', () => {
  it('renders value, delta, and sparkline (snapshot)', () => {
    const { container } = render(
      <KpiTile
        label="Velocity"
        value={42}
        delta={5.5}
        deltaSuffix="%"
        sparkline={[10, 12, 14, 11, 15, 18, 22]}
        hint="points / sprint"
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a flat delta when none provided', () => {
    const { container } = render(<KpiTile label="Backlog" value={120} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders as a button when onClick is provided', () => {
    const { container } = render(
      <KpiTile label="Click me" value="9" onClick={() => {}} />
    );
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('inverts delta tone when invertDelta is true (positive change = bad)', () => {
    const { container } = render(
      <KpiTile
        label="Failure rate"
        value="12%"
        delta={3}
        invertDelta
        sparkline={[1, 2, 3]}
      />
    );
    // The rose tint class indicates "bad" — invertDelta=true with positive
    // delta should render rose, not emerald.
    expect(container.innerHTML).toMatch(/rose/);
  });
});
