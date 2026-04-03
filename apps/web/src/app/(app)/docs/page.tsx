import { DocsShell } from '@/components/docs/docs-shell';

export const metadata = {
  title: 'Docs | TaskNebula',
};

export default function DocsPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <DocsShell />
    </div>
  );
}
