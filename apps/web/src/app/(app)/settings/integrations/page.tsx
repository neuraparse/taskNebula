import { IntegrationsGrid } from '@/components/settings/integrations-grid';

export const metadata = { title: 'Integrations · TaskNebula' };

export default function IntegrationsPage() {
  return (
    <div className="container max-w-6xl py-8">
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
