/**
 * Admin AI cost-guard kill switch
 *
 *   POST /api/admin/ai-usage/kill-switch
 *     body: { organizationId: string; enabled: boolean; reason?: string }
 *
 * Super-admin only. Toggles the per-org emergency stop. When the kill
 * switch is on, every call through `checkAndReserveTokens()` is
 * rejected with `kill_switch`, regardless of remaining budget.
 *
 * Also resets/initialises the org's `org_token_budgets` row in case it
 * didn't exist yet so an admin can flip the kill switch *before* an
 * org's first LLM call.
 *
 * Each toggle is mirrored into `audit_logs` so security teams can audit
 * who hit the big red button.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import {
  createAuditLog,
  db,
  organizations,
  orgTokenBudgets,
} from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  organizationId: z.string().min(1),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  // Optional budget update bundled with the toggle for convenience.
  dailyTokenLimit: z.number().int().nonnegative().nullable().optional(),
  monthlyTokenLimit: z.number().int().nonnegative().nullable().optional(),
  dailyCostUsdLimit: z.number().nonnegative().nullable().optional(),
  monthlyCostUsdLimit: z.number().nonnegative().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Super admin access required' },
      { status: 403 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, body.organizationId))
    .limit(1);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Upsert the budget row.
  const [existing] = await db
    .select()
    .from(orgTokenBudgets)
    .where(eq(orgTokenBudgets.organizationId, body.organizationId))
    .limit(1);

  const previousState = existing?.killSwitchEnabled ?? false;

  if (existing) {
    await db
      .update(orgTokenBudgets)
      .set({
        killSwitchEnabled: body.enabled,
        dailyTokenLimit:
          body.dailyTokenLimit === undefined
            ? existing.dailyTokenLimit
            : body.dailyTokenLimit,
        monthlyTokenLimit:
          body.monthlyTokenLimit === undefined
            ? existing.monthlyTokenLimit
            : body.monthlyTokenLimit,
        dailyCostUsdLimit:
          body.dailyCostUsdLimit === undefined
            ? existing.dailyCostUsdLimit
            : body.dailyCostUsdLimit === null
              ? null
              : body.dailyCostUsdLimit.toFixed(4),
        monthlyCostUsdLimit:
          body.monthlyCostUsdLimit === undefined
            ? existing.monthlyCostUsdLimit
            : body.monthlyCostUsdLimit === null
              ? null
              : body.monthlyCostUsdLimit.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(orgTokenBudgets.organizationId, body.organizationId));
  } else {
    await db.insert(orgTokenBudgets).values({
      organizationId: body.organizationId,
      killSwitchEnabled: body.enabled,
      dailyTokenLimit: body.dailyTokenLimit ?? null,
      monthlyTokenLimit: body.monthlyTokenLimit ?? null,
      dailyCostUsdLimit:
        body.dailyCostUsdLimit === undefined || body.dailyCostUsdLimit === null
          ? null
          : body.dailyCostUsdLimit.toFixed(4),
      monthlyCostUsdLimit:
        body.monthlyCostUsdLimit === undefined || body.monthlyCostUsdLimit === null
          ? null
          : body.monthlyCostUsdLimit.toFixed(4),
    });
  }

  // Audit the toggle. We piggyback on `agent.config_updated` rather than
  // adding a new enum value just for this; the metadata makes the
  // intent unambiguous.
  await createAuditLog({
    userId: session.user.id,
    organizationId: body.organizationId,
    action: 'agent.config_updated',
    resourceType: 'organization',
    resourceId: body.organizationId,
    metadata: {
      kind: 'ai_cost_guard_kill_switch',
      previous: previousState,
      next: body.enabled,
      reason: body.reason ?? null,
      limits: {
        dailyTokenLimit: body.dailyTokenLimit ?? null,
        monthlyTokenLimit: body.monthlyTokenLimit ?? null,
        dailyCostUsdLimit: body.dailyCostUsdLimit ?? null,
        monthlyCostUsdLimit: body.monthlyCostUsdLimit ?? null,
      },
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    organizationId: body.organizationId,
    killSwitchEnabled: body.enabled,
  });
}
