import { IntegrationsGrid } from '@/components/settings/integrations-grid';

export const metadata = { title: 'Integrations · TaskNebula' };

export default function IntegrationsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Connect TaskNebula to the tools your team uses every day.
        </p>
      </header>
      <IntegrationsGrid />
    </div>
  );
}
