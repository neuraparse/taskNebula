/**
 * Keep every modal on the same opaque semantic surface. The tests avoid
 * snapshotting Radix ids and instead guard the shared visual and positioning
 * contract.
 */
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom doesn't ship ResizeObserver; Radix Dialog uses it for outside-click.
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('Dialog surface contract', () => {
  it('uses an opaque semantic surface instead of decorative glass', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-surface">
          <DialogTitle>Settings dialog</DialogTitle>
          <DialogDescription>Stable semantic surface.</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByTestId('dialog-surface');
    expect(content.className).toMatch(/\bbg-background\b/);
    expect(content.className).toMatch(/\bborder\b/);
    expect(content.className).not.toMatch(/\bglass-panel\b/);
  });

  it('preserves layout positioning and animation classes', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-surface">
          <DialogTitle>Positioned</DialogTitle>
          <DialogDescription>Layout sanity check.</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByTestId('dialog-surface');
    // Existing modal positioning + animation hooks must still be present —
    // a refactor that wiped these would silently regress every dialog.
    expect(content.className).toMatch(/fixed/);
    expect(content.className).toMatch(/left-\[50%\]/);
    expect(content.className).toMatch(/top-\[50%\]/);
    expect(content.className).toMatch(/data-\[state=open\]:animate-fade-in/);
  });

  it('merges caller className without dropping the base surface', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-surface" className="custom-extra-class">
          <DialogTitle>Merged</DialogTitle>
          <DialogDescription>cn() merge sanity.</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByTestId('dialog-surface');
    expect(content.className).toMatch(/\bbg-background\b/);
    expect(content.className).toMatch(/\bcustom-extra-class\b/);
  });
});
