import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, intakeForms, intakeSubmissions } from '@tasknebula/db';
import { desc, eq } from 'drizzle-orm';
import type { IntakeFieldDefinition } from '@tasknebula/db';
import { getTranslations } from 'next-intl/server';
import { IntakeFormEditor } from '@/components/intake/intake-form-editor';
import { hasPermission } from '@/lib/auth/permissions';

export async function generateMetadata() {
  const t = await getTranslations('pagesSettings');
  return { title: t('intakeFormEdit.metaTitle') };
}

export default async function EditIntakeFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/settings/intake-forms/${id}/edit`);
  }

  const [form] = await db.select().from(intakeForms).where(eq(intakeForms.id, id)).limit(1);
  if (!form) notFound();

  if (!(await hasPermission(form.workspaceId, 'org:settings'))) {
    redirect('/dashboard?error=insufficient-permission');
  }

  const submissions = await db
    .select({
      id: intakeSubmissions.id,
      submittedByEmail: intakeSubmissions.submittedByEmail,
      status: intakeSubmissions.status,
      createdIssueId: intakeSubmissions.createdIssueId,
      createdAt: intakeSubmissions.createdAt,
    })
    .from(intakeSubmissions)
    .where(eq(intakeSubmissions.intakeFormId, id))
    .orderBy(desc(intakeSubmissions.createdAt))
    .limit(50);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-8">
      <IntakeFormEditor
        form={{
          id: form.id,
          slug: form.slug,
          title: form.title,
          description: form.description,
          fields: (form.fields as IntakeFieldDefinition[]) ?? [],
          isPublic: form.isPublic,
          requiresCaptcha: form.requiresCaptcha,
          targetStatus: form.targetStatus,
        }}
        recentSubmissions={submissions.map((s) => ({
          ...s,
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
        }))}
      />
    </div>
  );
}
