import { NextResponse } from 'next/server';
import { getPublicDocumentByToken } from '@/lib/docs/server';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const page = await getPublicDocumentByToken(token);

    if (!page) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (error) {
    console.error('Error fetching public document:', error);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}
