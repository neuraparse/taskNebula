import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, attachments, issues, projects, projectMembers, organizationMembers, users } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createId as cuid } from '@paralleldrive/cuid2';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
}

/**
 * Assert the caller is allowed to access attachments for this issue.
 * Access = super admin, org owner/admin, or any project member of the issue's project.
 * Returns the issue row when allowed, null when the issue is missing, or throws NextResponse-like errors via a status.
 */
async function assertIssueAccess(userId: string, issueId: string) {
  const [issue] = await db
    .select({
      id: issues.id,
      projectId: issues.projectId,
      organizationId: issues.organizationId,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    return { status: 404 as const, error: 'Issue not found', issue: null };
  }

  // Super admin bypass
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.isSuperAdmin) {
    return { status: 200 as const, issue };
  }

  // Org owner / admin
  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, issue.organizationId)
      )
    )
    .limit(1);

  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') {
    return { status: 200 as const, issue };
  }

  // Project member
  const [projectMember] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, issue.projectId)
      )
    )
    .limit(1);

  if (projectMember) {
    return { status: 200 as const, issue };
  }

  return { status: 403 as const, error: 'Forbidden', issue: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    const access = await assertIssueAccess(session.user.id, issueId);
    if (access.status !== 200) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Fetch attachments for the issue
    const issueAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.issueId, issueId));

    return NextResponse.json({ attachments: issueAttachments });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    const access = await assertIssueAccess(session.user.id, issueId);
    if (access.status !== 200) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await ensureUploadDir();

    // Generate unique filename
    const fileId = cuid();
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${fileId}.${fileExtension}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save attachment metadata to database
    const [attachment] = await db
      .insert(attachments)
      .values({
        id: fileId,
        issueId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/${fileName}`,
        uploadedById: session.user.id,
      })
      .returning();

    return NextResponse.json({ attachment });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 });
    }

    // Look up the attachment and verify it belongs to the issue in the URL
    const [attachment] = await db
      .select({ id: attachments.id, issueId: attachments.issueId })
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (attachment.issueId !== issueId) {
      return NextResponse.json({ error: 'Attachment does not belong to this issue' }, { status: 400 });
    }

    // Permission check against the owning issue's project/org
    const access = await assertIssueAccess(session.user.id, attachment.issueId);
    if (access.status !== 200) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Delete from database
    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    // Note: In production, also delete the physical file
    // For now, we'll leave files on disk for safety

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
