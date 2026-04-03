import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,#ffffff,rgba(248,250,252,0.92))] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#020617,rgba(2,6,23,0.96))] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/90 px-5 py-4 shadow-sm backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Globe2 className="h-3.5 w-3.5" />
                Public Page
              </Badge>
              {!page.allowSearchIndexing && (
                <Badge variant="outline" className="gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Search Hidden
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
            {page.excerpt && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                {page.excerpt}
              </p>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Updated {new Date(page.updatedAt).toLocaleString()}
            </div>
          </div>

          <Button asChild variant="outline">
            <Link href="/">
              TaskNebula
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-[32px] border border-border/70 bg-background/95 px-4 py-5 shadow-[0_30px_90px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8">
            <DocumentContentViewer content={page.contentJson} />
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
              <div className="text-sm font-semibold">Sharing Safety</div>
              <Separator className="my-3" />
              <p className="text-sm leading-6 text-muted-foreground">
                This public view hides workspace-only metadata, task relations, revision authors, and any uploaded
                files that were not explicitly published with the page.
              </p>
            </div>

            {page.attachments.length > 0 && (
              <div className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
                <div className="text-sm font-semibold">Published Files</div>
                <Separator className="my-3" />
                <div className="space-y-2">
                  {page.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <div className="font-medium">{attachment.fileName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{attachment.mimeType}</div>
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
