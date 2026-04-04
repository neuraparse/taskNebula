import { NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { handleLivekitWebhookEvent } from '@/lib/chat/server';

function getWebhookReceiver() {
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';

  if (!apiKey || !apiSecret) {
    return null;
  }

  return new WebhookReceiver(apiKey, apiSecret);
}

export async function POST(request: Request) {
  const receiver = getWebhookReceiver();
  if (!receiver) {
    return NextResponse.json({ error: 'LiveKit webhook receiver is not configured' }, { status: 503 });
  }

  try {
    const body = await request.text();
    const authHeader =
      request.headers.get('authorization') || request.headers.get('Authorize') || undefined;
    const event = await receiver.receive(body, authHeader);

    const result = await handleLivekitWebhookEvent({
      event: event.event,
      roomName: event.room?.name || null,
      participantIdentity: event.participant?.identity || null,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Failed to process LiveKit webhook:', error);
    return NextResponse.json({ error: 'Invalid LiveKit webhook' }, { status: 401 });
  }
}
