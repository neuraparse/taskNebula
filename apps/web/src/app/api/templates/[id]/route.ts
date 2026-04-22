import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, eq, projectTemplates } from '@tasknebula/db';
import { auth } from '@/auth';
import { getTemplateAuthz } from '../route';

export const dynamic = 'force-dynamic';

const TEMPLATE_KINDS = ['project', 'issue', 'doc'] as const;

const patchTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(TEMPLATE_KINDS).optional(),
  category: z.string().max(64).optional(),
  icon: z.string().max(64).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  payload: z.record(z.any()).optional(),
});

async function loadTemplate(id: string) {
  const [row] = await db
    .select()
    .from(projectTemplates)
    .where(eq(projectTemplates.id, id))
    .limit(1);
  return row ?? null;
}

// GET /api/templates/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const authz = await getTemplateAuthz(session.user.id, template.organizationId);
  if (!authz.isMember && !template.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(template);
}

// PATCH /api/templates/[id] — admin only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const authz = await getTemplateAuthz(session.user.id, template.organizationId);
  if (!authz.canAdminister) {
    return NextResponse.json(
      { error: 'Only organization owners or admins can edit templates.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = patchTemplateSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.kind !== undefined) updates.kind = data.kind;
    if (data.category !== undefined) updates.category = data.category;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.color !== undefined) updates.color = data.color;
    if (data.payload !== undefined) updates.payload = data.payload;

    const [updated] = await db
      .update(projectTemplates)
      .set(updates)
      .where(eq(projectTemplates.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[api/templates/:id] PATCH failed', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] — admin only.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const authz = await getTemplateAuthz(session.user.id, template.organizationId);
  if (!authz.canAdminister) {
    return NextResponse.json(
      { error: 'Only organization owners or admins can delete templates.' },
      { status: 403 }
    );
  }

  await db.delete(projectTemplates).where(eq(projectTemplates.id, id));
  return NextResponse.json({ ok: true });
}
