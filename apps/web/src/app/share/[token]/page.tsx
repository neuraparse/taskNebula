import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
    <main className="min-h-dvh bg-background">
      <article className="mx-auto max-w-3xl animate-blur-in px-4 py-10 sm:px-6 sm:py-14">
        <div className="surface-card rounded-lg p-6 sm:p-10 space-y-6">
          {/* Document header — quiet, no card chrome */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip flex items-center gap-1.5">
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

            <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
              {page.title}
            </h1>

            {page.excerpt && (
              <p className="text-base leading-7 text-muted-foreground">{page.excerpt}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Updated {new Date(page.updatedAt).toLocaleString()}
            </p>
          </header>

          {/* Content */}
          <section>
            <DocumentContentViewer content={page.contentJson} />
          </section>

          {/* Attachments — inline, no nested card */}
          {page.attachments.length > 0 && (
            <section className="space-y-3 pt-2">
              <h2 className="text-sm font-medium text-foreground">Published files</h2>
              <ul className="space-y-2">
                {page.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={attachment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md border border-border px-3 py-2 text-sm transition-all duration-150 ease-snap hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="font-medium text-foreground">{attachment.fileName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{attachment.mimeType}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer — quiet, one action */}
          <footer className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              This public view hides workspace metadata and unpublished files.
            </p>
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <Link href="/">
                TaskNebula
                <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </footer>
        </div>
      </article>
    </main>
  );
}
