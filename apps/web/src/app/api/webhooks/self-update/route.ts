import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  handleSelfUpdateCallback,
  SelfUpdateError,
  type SelfUpdateCallbackInput,
} from '@/lib/version/self-update';

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

const callbackSchema = z.object({
  jobId: z.string().min(8).max(128),
  status: z.enum(['running', 'succeeded', 'failed']),
  message: z.string().max(500).optional().nullable(),
  webhookStatus: z.number().int().min(100).max(599).optional().nullable(),
  backup: z.unknown().optional().nullable(),
});

function signature(secret: string, timestamp: string, body: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function validSignature(secret: string, timestamp: string, body: string, header: string | null) {
  const provided = header?.startsWith('sha256=') ? header.slice('sha256='.length) : null;
  if (!provided || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = signature(secret, timestamp, body);
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

export async function POST(request: NextRequest) {
  const secret = process.env.TASKNEBULA_SELF_UPDATE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Self-update callback is not configured' }, { status: 503 });
  }

  const timestamp = request.headers.get('x-tasknebula-timestamp') ?? '';
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS
  ) {
    return NextResponse.json({ error: 'Invalid callback timestamp' }, { status: 401 });
  }

  const body = await request.text();
  if (!validSignature(secret, timestamp, body, request.headers.get('x-tasknebula-signature'))) {
    return NextResponse.json({ error: 'Invalid callback signature' }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body || '{}') as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid callback JSON' }, { status: 400 });
  }
  const parsed = callbackSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid callback payload' }, { status: 400 });
  }

  try {
    const job = await handleSelfUpdateCallback(parsed.data as SelfUpdateCallbackInput);
    return NextResponse.json({ ok: true, jobId: job.id, status: job.status });
  } catch (err) {
    if (err instanceof SelfUpdateError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update self-update job' }, { status: 500 });
  }
}
