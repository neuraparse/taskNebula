import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ResolutionSelect } from '../resolution-select';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

describe('ResolutionSelect', () => {
  it('shows an Unresolved trigger when no resolution is set', () => {
    render(<ResolutionSelect value={null} onChange={jest.fn()} />);

    expect(screen.getByText('Unresolved')).toBeInTheDocument();
  });

  it('sets a resolution from the dropdown', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<ResolutionSelect value={null} onChange={onChange} />);

    await user.click(screen.getByText('Unresolved'));
    await user.click(await screen.findByText("Won't Do"));

    expect(onChange).toHaveBeenCalledWith('wont_do');
  });

  it('renders a read-only chip when a resolution is set', () => {
    render(
      <ResolutionSelect value="fixed" resolvedAt="2026-06-01T00:00:00Z" onChange={jest.fn()} />
    );

    expect(screen.getByText('Fixed')).toBeInTheDocument();
    // No "Unresolved" trigger in the resolved state.
    expect(screen.queryByText('Unresolved')).not.toBeInTheDocument();
  });

  it('clears the resolution via the dropdown', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<ResolutionSelect value="done" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Set resolution' }));
    await user.click(await screen.findByText('Clear resolution'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('hides the clear action when nothing is set', async () => {
    const user = userEvent.setup();

    render(<ResolutionSelect value={null} onChange={jest.fn()} />);

    await user.click(screen.getByText('Unresolved'));
    await screen.findByText('Fixed');

    expect(screen.queryByText('Clear resolution')).not.toBeInTheDocument();
  });
});
