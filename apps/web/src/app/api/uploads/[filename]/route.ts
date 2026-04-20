import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/auth';
import {
  db,
  attachments,
  documentPageAttachments,
  documentPages,
  issues,
  projects,
  projectMembers,
  organizationMembers,
  users,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await params;

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Resolve the owning record (attachment or document page attachment)
    // Both store filePath as `/uploads/<filename>`
    const storedPath = `/uploads/${filename}`;

    const allowed = await userCanAccessFile(session.user.id, storedPath);
    if (allowed === 'not_found') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (allowed === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filePath = join(UPLOAD_DIR, filename);

    try {
      const fileBuffer = await readFile(filePath);

      // Determine content type based on file extension
      const ext = filename.split('.').pop()?.toLowerCase();
      const contentType = getContentType(ext || '');

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    } catch (error) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type AccessResult = 'ok' | 'forbidden' | 'not_found';

async function userCanAccessFile(userId: string, storedPath: string): Promise<AccessResult> {
  // Super admin bypass
  const [currentUser] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  // Try issue attachment first
  const [issueAttachment] = await db
    .select({
      id: attachments.id,
      issueId: attachments.issueId,
    })
    .from(attachments)
    .where(eq(attachments.filePath, storedPath))
    .limit(1);

  if (issueAttachment) {
    if (isSuperAdmin) return 'ok';
    const [issue] = await db
      .select({
        projectId: issues.projectId,
        organizationId: issues.organizationId,
      })
      .from(issues)
      .where(eq(issues.id, issueAttachment.issueId))
      .limit(1);

    if (!issue) return 'not_found';

    return (await canAccessProject(userId, issue.projectId, issue.organizationId))
      ? 'ok'
      : 'forbidden';
  }

  // Try document page attachment
  const [pageAttachment] = await db
    .select({
      id: documentPageAttachments.id,
      pageId: documentPageAttachments.pageId,
    })
    .from(documentPageAttachments)
    .where(eq(documentPageAttachments.filePath, storedPath))
    .limit(1);

  if (pageAttachment) {
    if (isSuperAdmin) return 'ok';
    const [page] = await db
      .select({
        projectId: documentPages.projectId,
        organizationId: documentPages.organizationId,
      })
      .from(documentPages)
      .where(eq(documentPages.id, pageAttachment.pageId))
      .limit(1);

    if (!page) return 'not_found';

    // If page is org-scoped (no project), require org membership only
    if (!page.projectId) {
      const [orgMember] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, page.organizationId)
          )
        )
        .limit(1);
      return orgMember ? 'ok' : 'forbidden';
    }

    return (await canAccessProject(userId, page.projectId, page.organizationId))
      ? 'ok'
      : 'forbidden';
  }

  return 'not_found';
}

async function canAccessProject(userId: string, projectId: string, organizationId: string): Promise<boolean> {
  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') {
    return true;
  }

  const [projectMember] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId)
      )
    )
    .limit(1);

  return !!projectMember;
}

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    zip: 'application/zip',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  return contentTypes[ext] || 'application/octet-stream';
}
