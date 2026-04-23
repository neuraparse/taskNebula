import type { Metadata } from 'next';

import { TemplatesGrid } from '@/components/templates/templates-grid';

export const metadata: Metadata = {
  title: 'Templates · TaskNebula',
  description:
    'Reusable starting points for work items, projects, and pages.',
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable starting points for work items, projects, and pages.
        </p>
      </header>
      <TemplatesGrid />
    </div>
  );
}
