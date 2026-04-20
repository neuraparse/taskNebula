import { render, screen } from '@testing-library/react';
import { Progress } from '../progress';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as any).ResizeObserver = RO;
  (window as any).DOMRect = { fromRect: () => ({}) };
});

describe('Progress', () => {
  it('renders with a progressbar role', () => {
    render(<Progress value={60} aria-label="progress-bar" />);
    expect(screen.getByRole('progressbar', { name: /progress-bar/i })).toBeInTheDocument();
  });

  it('applies the correct transform to the indicator for a given value', () => {
    const { container } = render(<Progress value={60} />);
    const indicator = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.style.transform).toBe('translateX(-40%)');
  });

  it('treats undefined value as 0% progress', () => {
    const { container } = render(<Progress />);
    const indicator = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.style.transform).toBe('translateX(-100%)');
  });
});
