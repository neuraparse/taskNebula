import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db, intakeForms } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import type { IntakeFieldDefinition } from '@tasknebula/db';
import { PublicIntakeForm } from '@/components/intake/public-intake-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('publicPages.intake');
  const [form] = await db
    .select({ title: intakeForms.title, description: intakeForms.description })
    .from(intakeForms)
    .where(eq(intakeForms.slug, slug))
    .limit(1);

  if (!form) {
    return { title: t('submitMetaTitle'), robots: { index: false, follow: false } };
  }
  return {
    title: `${form.title} · TaskNebula`,
    description: form.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function PublicIntakePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [form] = await db.select().from(intakeForms).where(eq(intakeForms.slug, slug)).limit(1);

  if (!form || !form.isPublic) {
    notFound();
  }

  const fields = (form.fields as IntakeFieldDefinition[]) ?? [];

  return (
    <main className="bg-background min-h-dvh">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="surface-card space-y-6 rounded-lg p-6 sm:p-10">
          <header className="space-y-3">
            <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
              {form.title}
            </h1>
            {form.description ? (
              <p className="text-muted-foreground text-base leading-7">{form.description}</p>
            ) : null}
          </header>

          <PublicIntakeForm
            slug={form.slug}
            fields={fields}
            requiresCaptcha={form.requiresCaptcha}
          />
        </div>
      </div>
    </main>
  );
}
