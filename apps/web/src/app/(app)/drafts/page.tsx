import { DraftsList } from '@/components/drafts/drafts-list';

export const metadata = { title: 'Drafts · TaskNebula' };

export default function DraftsPage() {
  return (
    <div className="container max-w-5xl py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personal scratch area for work in progress.</p>
      </header>
      <DraftsList />
    </div>
  );
}
