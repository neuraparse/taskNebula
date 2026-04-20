import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  (window as any).ResizeObserver = RO;
  (window as any).DOMRect = { fromRect: () => ({}) };
});

describe('Dialog', () => {
  it('renders title and description when open', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText('Dialog title')).toBeInTheDocument();
    expect(screen.getByText('Dialog description')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when the close button is clicked', async () => {
    const user = userEvent.setup();
    const handleOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const user = userEvent.setup();
    const handleOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    await user.keyboard('{Escape}');
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
