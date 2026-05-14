/**
 * AiBadge — render + tooltip metadata tests.
 *
 * Verifies that AI-output surfaces produce a visible, machine-readable badge
 * (EU AI Act Article 50 requirement) and that the tooltip text is composed
 * from the supplied model + feature + timestamp.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiBadge } from '../AiBadge';

jest.mock('@/lib/hooks/use-ai-trace', () => ({
  useAiTrace: () => null,
}));

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe('AiBadge', () => {
  it('renders the default "Generated with AI" label', () => {
    render(withQueryClient(<AiBadge feature="Draft Issue" model="Claude Sonnet" />));
    expect(screen.getByText('Generated with AI')).toBeInTheDocument();
  });

  it('exposes data-ai-generated for machine readability', () => {
    render(withQueryClient(<AiBadge feature="Ask" model="GPT-4" />));
    const badge = screen.getByTestId('ai-badge');
    expect(badge).toHaveAttribute('data-ai-generated', 'true');
  });

  it('builds the aria-label from model + feature + timestamp', () => {
    const fixed = new Date('2026-05-14T10:32:00');
    render(
      withQueryClient(
        <AiBadge feature="Draft Issue" model="Claude Sonnet" generatedAt={fixed} />
      )
    );
    const badge = screen.getByTestId('ai-badge');
    const aria = badge.getAttribute('aria-label') ?? '';
    expect(aria).toContain('AI-generated content');
    expect(aria).toContain('Claude Sonnet');
    expect(aria).toContain('Draft Issue');
    expect(aria).toContain('2026-05-14');
  });

  it('renders a custom label override', () => {
    render(
      withQueryClient(<AiBadge label="AI-assisted" feature="Assist" model="x" />)
    );
    expect(screen.getByText('AI-assisted')).toBeInTheDocument();
  });

  it('falls back to "Generated with AI" tooltip when no metadata is provided', () => {
    render(withQueryClient(<AiBadge />));
    const badge = screen.getByTestId('ai-badge');
    expect(badge.getAttribute('aria-label')).toContain('Generated with AI');
  });

  it('handles invalid timestamps gracefully', () => {
    render(
      withQueryClient(
        <AiBadge feature="X" model="Y" generatedAt={'not-a-date' as unknown as string} />
      )
    );
    const badge = screen.getByTestId('ai-badge');
    const aria = badge.getAttribute('aria-label') ?? '';
    expect(aria).toContain('Y');
    expect(aria).toContain('X');
  });
});
