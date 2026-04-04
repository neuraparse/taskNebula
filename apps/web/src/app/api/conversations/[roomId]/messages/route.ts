import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { createId as cuid } from '@paralleldrive/cuid2';
import {
  ChatAccessError,
  createConversationMessage,
  listConversationMessagesPage,
  resolveConversationRoomAccess,
} from '@/lib/chat/server';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const beforeMessageId = request.nextUrl.searchParams.get('before');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const access = await resolveConversationRoomAccess(session.user.id, roomId);
    if (!access) {
      return NextResponse.json({ error: 'Conversation not found or unavailable' }, { status: 404 });
    }

    const page = await listConversationMessagesPage(roomId, session.user.id, {
      beforeMessageId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load conversation messages:', error);
    return NextResponse.json({ error: 'Failed to load conversation messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const contentType = request.headers.get('content-type') || '';
    let body = '';
    let parentMessageId: string | null = null;
    let attachments: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
      uploadedById: string;
      uploadedAt: string;
    }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = String(formData.get('body') || '');
      parentMessageId = (formData.get('parentMessageId') as string | null) || null;
      const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);

      if (files.length) {
        await ensureUploadDir();

        attachments = await Promise.all(
          files.map(async (file) => {
            if (file.size > MAX_FILE_SIZE) {
              throw new ChatAccessError(`${file.name} exceeds the 10MB limit.`, 400);
            }

            const fileId = cuid();
            const extension = file.name.split('.').pop() || 'bin';
            const storedName = `${fileId}.${extension}`;
            const bytes = await file.arrayBuffer();
            await writeFile(join(UPLOAD_DIR, storedName), Buffer.from(bytes));

            return {
              id: fileId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || 'application/octet-stream',
              filePath: `/uploads/${storedName}`,
              uploadedById: session.user.id,
              uploadedAt: new Date().toISOString(),
            };
          })
        );
      }
    } else {
      const payload = await request.json();
      body = String(payload.body || '');
      parentMessageId = payload.parentMessageId || null;
    }

    if (!body.trim() && attachments.length === 0) {
      return NextResponse.json({ error: 'Message body or attachments are required' }, { status: 400 });
    }

    const message = await createConversationMessage({
      roomId,
      userId: session.user.id,
      body,
      parentMessageId,
      attachments,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create conversation message:', error);
    return NextResponse.json({ error: 'Failed to create conversation message' }, { status: 500 });
  }
}
