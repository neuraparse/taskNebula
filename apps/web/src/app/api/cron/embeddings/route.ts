/**
 * POST /api/cron/embeddings
 *
 * Drains queued issue/comment embedding jobs. The route is intentionally
 * cron-authenticated and does not claim jobs when the embedding provider is
 * unavailable, so a deployment can add OPENAI_API_KEY later without losing
 * pending work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/agents/cron-auth';
import { drainEmbeddingQueue, getDefaultEmbeddingProvider } from '@/lib/search/embeddings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_BATCH_SIZE = 16;
const MAX_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = (await request.json()) as { batchSize?: unknown };
    if (typeof body.batchSize === 'number' && Number.isFinite(body.batchSize)) {
      batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(body.batchSize)));
    }
  } catch {
    // Empty body is valid; use the conservative default batch size.
  }

  const provider = getDefaultEmbeddingProvider();
  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        code: 'embedding_provider_unavailable',
        error: 'OPENAI_API_KEY is required to drain embedding jobs.',
      },
      { status: 412 }
    );
  }

  const startedAt = new Date();
  const result = await drainEmbeddingQueue({ batchSize, provider });

  return NextResponse.json({
    ok: true,
    batchSize,
    ...result,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  });
}
