import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeTrackingPanel } from '../time-tracking-panel';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('TimeTrackingPanel', () => {
  it('keeps the manual log controls stacked in the issue detail sidebar', () => {
    const Wrapper = wrapper();
    render(
      <Wrapper>
        <TimeTrackingPanel issueId="issue-1" initialEstimateHours={2} initialActualHours={0.5} />
      </Wrapper>
    );

    const durationInput = screen.getByPlaceholderText('e.g. 30m or 1h 15m');
    const noteInput = screen.getByPlaceholderText('What did you do? (optional)');
    const logButton = screen.getByRole('button', { name: 'Log' });

    expect(durationInput.parentElement).toHaveClass('grid', 'gap-2');
    expect(durationInput).toHaveClass('min-w-0');
    expect(noteInput).toHaveClass('min-h-16', 'resize-none');
    expect(logButton).toHaveClass('w-full');
  });
});
