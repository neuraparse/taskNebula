import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DocumentContentViewer } from '@/components/docs/document-content-viewer';
import { getPublicDocumentByToken } from '@/lib/docs/server';
import { ExternalLink, Globe2, LockKeyhole } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const page = await getPublicDocumentByToken(token);

  if (!page) {
    return {
      title: 'Shared document',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${page.title} · TaskNebula Docs`,
    description: page.excerpt || 'Shared from TaskNebula Docs',
    robots: page.allowSearchIndexing
      ? {
          index: true,
          follow: true,
        }
      : {
          index: false,
          follow: false,
        },
  };
}

export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await getPublicDocumentByToken(token);

  if (!page) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Header bar */}
        <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-lg">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip gap-1.5 flex items-center">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                Public
              </span>
              {!page.allowSearchIndexing && (
                <span className="chip flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  Search hidden
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {page.title}
            </h1>
            {page.excerpt && (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{page.excerpt}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Updated {new Date(page.updatedAt).toLocaleString()}
            </p>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/">
              TaskNebula
              <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* Content grid */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="surface-card px-4 py-5 sm:px-8 sm:py-8 rounded-lg">
            <DocumentContentViewer content={page.contentJson} />
          </section>

          <aside className="space-y-4">
            <div className="surface-inset p-5 rounded-lg">
              <p className="text-sm font-medium text-foreground">Sharing safety</p>
              <Separator className="my-3" />
              <p className="text-sm leading-6 text-muted-foreground">
                This public view hides workspace-only metadata, task relations, revision authors,
                and any files not explicitly published with the page.
              </p>
            </div>

            {page.attachments.length > 0 && (
              <div className="surface-inset p-5 rounded-lg">
                <p className="text-sm font-medium text-foreground">Published files</p>
                <Separator className="my-3" />
                <div className="space-y-2">
                  {page.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md border border-border px-3 py-2 text-sm transition-colors duration-200 hover:bg-accent"
                    >
                      <div className="font-medium text-foreground">{attachment.fileName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{attachment.mimeType}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
