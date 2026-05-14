/**
 * FEAT-31 — verify the dark glassmorphism utility (`glass-panel`) is wired
 * onto Dialog content. We don't snapshot the entire portal subtree (it's
 * noisy and Radix injects ids on every render); instead we assert the
 * className list contains the new utility and that legacy positioning
 * classes are preserved. That keeps the test stable across Radix bumps
 * while still catching accidental removal of the modernization.
 */
import { render, screen } from '@testing-library/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../dialog';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom doesn't ship ResizeObserver; Radix Dialog uses it for outside-click.
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('Dialog · glass-panel utility (FEAT-31)', () => {
  it('applies the glass-panel class to DialogContent', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-glass">
          <DialogTitle>Glass dialog</DialogTitle>
          <DialogDescription>Hairline + dark blur surface.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByTestId('dialog-glass');
    expect(content.className).toMatch(/\bglass-panel\b/);
  });

  it('preserves layout positioning classes alongside glass-panel', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-glass">
          <DialogTitle>Positioned</DialogTitle>
          <DialogDescription>Layout sanity check.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByTestId('dialog-glass');
    // Existing modal positioning + animation hooks must still be present —
    // a refactor that wiped these would silently regress every dialog.
    expect(content.className).toMatch(/fixed/);
    expect(content.className).toMatch(/left-\[50%\]/);
    expect(content.className).toMatch(/top-\[50%\]/);
    expect(content.className).toMatch(/data-\[state=open\]:animate-fade-in/);
  });

  it('merges caller className without dropping glass-panel', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-glass" className="custom-extra-class">
          <DialogTitle>Merged</DialogTitle>
          <DialogDescription>cn() merge sanity.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByTestId('dialog-glass');
    expect(content.className).toMatch(/\bglass-panel\b/);
    expect(content.className).toMatch(/\bcustom-extra-class\b/);
  });
});
