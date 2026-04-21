import { DocsShell } from '@/components/docs/docs-shell';

export default async function ProjectDocsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="h-full min-h-0 overflow-hidden animate-fade-in">
      <DocsShell projectId={projectId} />
    </div>
  );
}
