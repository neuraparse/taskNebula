/**
 * POST /api/ask — Ask TaskNebula RAG Q&A.
 *
 * Body: { query: string; projectId?: string; scope?: 'all' | 'issues' | 'docs' }
 *
 * Responds with a Server-Sent Events stream. Frame types:
 *   - data: {"type":"sources","sources":[...]}    citations the model can use
 *   - data: {"type":"token","text":"..."}          one streamed token chunk
 *   - data: {"type":"citations","citations":[...]}  parsed [TN-..]/[DOC-..] refs
 *   - data: {"type":"done","usage":{...}}          terminal frame
 *   - data: {"type":"error","error":"...","code":"..."} terminal failure frame
 *
 * Rate-limited at 10/min/user via Redis token bucket (in-memory fallback).
 * Every call writes one row to `llm_call_audit` with hashed prompt + cost.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, db, organizationMembers, llmCallAudit } from '@tasknebula/db';
import { auth } from '@/auth';
import { aiDisabledResponse, isAiFeatureEnabled } from '@/lib/ai/feature-gate';
import { runAsk, AskError, type AskUsage } from '@/lib/agents/ask';
import { parseCitations } from '@/lib/agents/citation-parser';
import { consumeRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  query: z.string().min(1).max(2000),
  projectId: z.string().min(1).max(64).optional().nullable(),
  scope: z.enum(['all', 'issues', 'docs']).optional(),
  organizationId: z.string().min(1).max(64).optional(),
});

function sseFrame(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

async function resolveOrganizationId(
  userId: string,
  requested?: string | null
): Promise<string | null> {
  if (requested) {
    const [member] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, requested),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    return member?.organizationId ?? null;
  }
  // No org passed: use the user's first membership. The UI should always
  // pass it explicitly; this is just a safety net.
  const [member] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
    .limit(1);
  return member?.organizationId ?? null;
}

export async function POST(request: NextRequest) {
  if (!(await isAiFeatureEnabled())) {
    return aiDisabledResponse();
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // --- rate limit -----------------------------------------------------------
  const rl = await consumeRateLimit({
    bucket: 'ask',
    key: session.user.id,
    limit: 10,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please wait before asking again.',
        code: 'rate_limited',
        retryAfter: rl.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSec),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      }
    );
  }

  const organizationId = await resolveOrganizationId(session.user.id, payload.organizationId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No accessible organization for this user.', code: 'no_org' },
      { status: 403 }
    );
  }

  // --- spin up the Ask agent ------------------------------------------------
  let bundle: Awaited<ReturnType<typeof runAsk>>;
  try {
    bundle = await runAsk({
      query: payload.query,
      organizationId,
      projectId: payload.projectId ?? null,
      scope: payload.scope ?? 'all',
    });
  } catch (err) {
    if (err instanceof AskError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'missing_credential' ? 412 : 400 }
      );
    }
    console.error('runAsk failed:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }

  const userId = session.user.id;
  const start = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let aborted = false;
      const keepalive = setInterval(() => {
        if (aborted) return;
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          aborted = true;
        }
      }, 25_000);

      const onAbort = () => {
        aborted = true;
      };
      request.signal.addEventListener('abort', onAbort);

      // Accumulate the answer text so we can run the citation parser once
      // the model has finished streaming.
      let answer = '';
      let lastUsage: AskUsage = {
        model: '',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        reranked: false,
        promptHash: '',
      };
      let status: 'success' | 'error' = 'success';
      let errorMessage: string | null = null;

      try {
        for await (const event of bundle.events) {
          if (aborted) break;

          if (event.type === 'sources') {
            controller.enqueue(sseFrame(event));
          } else if (event.type === 'token') {
            answer += event.text;
            controller.enqueue(sseFrame(event));
          } else if (event.type === 'error') {
            status = 'error';
            errorMessage = event.error;
            controller.enqueue(sseFrame(event));
          } else if (event.type === 'done') {
            lastUsage = event.usage;
            const citations = parseCitations(answer, bundle.sources);
            controller.enqueue(sseFrame({ type: 'citations', citations }));
            controller.enqueue(sseFrame(event));
          }
        }
      } catch (err) {
        status = 'error';
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(sseFrame({ type: 'error', error: errorMessage, code: 'stream_failed' }));
      } finally {
        clearInterval(keepalive);
        request.signal.removeEventListener('abort', onAbort);
        try {
          controller.close();
        } catch {
          // Already closed.
        }

        // Best-effort audit write. We never throw out of finally so a flaky
        // DB doesn't blow up the response a millisecond after the user
        // already received the answer.
        try {
          await db.insert(llmCallAudit).values({
            organizationId,
            userId,
            feature: 'ask',
            provider: 'anthropic',
            model: lastUsage.model || (process.env.CLAUDE_ASK_MODEL ?? 'claude-sonnet-4-6'),
            promptHash: lastUsage.promptHash || '',
            inputTokens: lastUsage.inputTokens || 0,
            outputTokens: lastUsage.outputTokens || 0,
            costUsd: String(lastUsage.costUsd || 0),
            latencyMs: lastUsage.latencyMs || Date.now() - start,
            status,
            errorMessage: errorMessage ?? null,
          });
        } catch (err) {
          console.warn('llm_call_audit insert failed', err);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-RateLimit-Limit': String(rl.limit),
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    },
  });
}
