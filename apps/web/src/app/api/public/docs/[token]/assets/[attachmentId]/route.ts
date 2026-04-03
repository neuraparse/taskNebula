import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { and, db, documentPageAttachments, documentPages, eq } from '@tasknebula/db';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; attachmentId: string }> }
) {
  try {
    const { token, attachmentId } = await params;

    const [page] = await db
      .select({
        id: documentPages.id,
        publicShareIncludeAttachments: documentPages.publicShareIncludeAttachments,
      })
      .from(documentPages)
      .where(
        and(
          eq(documentPages.publicShareToken, token),
          eq(documentPages.publicShareEnabled, true),
          eq(documentPages.isArchived, false)
        )
      )
      .limit(1);

    if (!page || !page.publicShareIncludeAttachments) {
      return NextResponse.json({ error: 'Attachment not available' }, { status: 404 });
    }

    const [attachment] = await db
      .select()
      .from(documentPageAttachments)
      .where(
        and(
          eq(documentPageAttachments.id, attachmentId),
          eq(documentPageAttachments.pageId, page.id)
        )
      )
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const filename = attachment.filePath.split('/').pop();
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid attachment path' }, { status: 400 });
    }

    const fileBuffer = await readFile(join(UPLOAD_DIR, filename));

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error serving public document attachment:', error);
    return NextResponse.json({ error: 'Failed to serve attachment' }, { status: 500 });
  }
}
