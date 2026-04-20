import { render } from '@testing-library/react';
import { Separator } from '../separator';

describe('Separator', () => {
  it('renders with default horizontal orientation', () => {
    const { container } = render(<Separator data-testid="sep" />);
    const sep = container.querySelector('[data-testid="sep"]');
    expect(sep).not.toBeNull();
    expect(sep).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('renders with vertical orientation', () => {
    const { container } = render(
      <Separator orientation="vertical" data-testid="sep-v" />
    );
    const sep = container.querySelector('[data-testid="sep-v"]');
    expect(sep).not.toBeNull();
    expect(sep).toHaveAttribute('data-orientation', 'vertical');
  });

  it('is decorative by default (role="none")', () => {
    const { container } = render(<Separator data-testid="sep-dec" />);
    const sep = container.querySelector('[data-testid="sep-dec"]') as HTMLElement;
    expect(sep.getAttribute('role')).toBe('none');
  });

  it('renders with role="separator" when decorative=false', () => {
    const { container } = render(
      <Separator decorative={false} data-testid="sep-sem" />
    );
    const sep = container.querySelector('[data-testid="sep-sem"]') as HTMLElement;
    expect(sep.getAttribute('role')).toBe('separator');
  });
});
