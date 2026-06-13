import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, intakeForms, organizationMembers, projects } from '@tasknebula/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { IntakeFormsList } from '@/components/intake/intake-forms-list';

export async function generateMetadata() {
  const t = await getTranslations('pagesSettings');
  return { title: t('intakeForms.metaTitle') };
}

/**
 * Settings → Intake forms. Lists every form belonging to organizations
 * the caller is a member of, plus the project labels for context.
 */
export default async function IntakeFormsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/intake-forms');
  }

  const orgMemberships = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  const orgIds = orgMemberships.map((m) => m.organizationId);

  const forms = orgIds.length
    ? await db
        .select({
          id: intakeForms.id,
          slug: intakeForms.slug,
          title: intakeForms.title,
          description: intakeForms.description,
          isPublic: intakeForms.isPublic,
          projectId: intakeForms.projectId,
          updatedAt: intakeForms.updatedAt,
        })
        .from(intakeForms)
        .where(inArray(intakeForms.workspaceId, orgIds))
        .orderBy(desc(intakeForms.updatedAt))
    : [];

  // Pull the small set of project labels we need so the list can show
  // "Project — Slug" without forcing an N+1 from the client.
  const projectIds = Array.from(new Set(forms.map((f) => f.projectId)));
  const projectRows =
    orgIds.length && projectIds.length
      ? await db
          .select({ id: projects.id, name: projects.name, key: projects.key })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];

  const accessibleProjects = orgIds.length
    ? await db
        .select({ id: projects.id, name: projects.name, key: projects.key })
        .from(projects)
        .where(inArray(projects.organizationId, orgIds))
    : [];

  const t = await getTranslations('pagesSettings');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('intakeForms.title')}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t('intakeForms.subtitle')}</p>
      </header>
      <IntakeFormsList
        forms={forms}
        projectLookup={Object.fromEntries(projectRows.map((p) => [p.id, p]))}
        accessibleProjects={accessibleProjects}
      />
    </div>
  );
}
