/**
 * Layout for public-facing pages (no auth required). Keeps the document
 * chrome minimal — no sidebars, no command palette, no AI provider.
 *
 * Routes that mount here must also be allow-listed in middleware.ts.
 */

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
