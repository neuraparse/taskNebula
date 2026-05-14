/**
 * GET /api/inbox/catch-me-up?since=<ISO> — AI-summarized digest of unread &
 * recent activity since the given timestamp.
 *
 * Defaults `since` to either the user's `last_seen_at` or 24h ago when the
 * column is null. Picks Claude Haiku as the default model (cheapest tier)
 * but honors the workspace's configured model when set.
 *
 * Returns `{ summary_markdown, action_items: [{ title, link, urgency }] }`.
 * Always returns a 200 with a usable digest — falls back to a deterministic
 * heuristic if AI is disabled or the provider call fails so the dashboard
 * banner never shows an error UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  notifications,
  users,
  issues,
  projects,
  organizations,
  organizationMembers,
  eq,
  and,
  gte,
  desc,
} from '@tasknebula/db';
import { isAiFeatureEnabled } from '@/lib/ai/feature-gate';
import {
  catchMeUp,
  catchMeUpNative,
  CATCH_ME_UP_DEFAULT_MODEL,
  type NotificationDigestInput,
} from '@/lib/ai/catch-me-up';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { resolveProviderApiKeyFromSettings } from '@/lib/agents/credentials';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';

export const dynamic = 'force-dynamic';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');

    // Resolve `since`: explicit param > last_seen_at > 24h ago.
    let since: Date;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      since = Number.isNaN(parsed.getTime())
        ? new Date(Date.now() - TWENTY_FOUR_HOURS_MS)
        : parsed;
    } else {
      const [me] = await db
        .select({ lastSeenAt: users.lastSeenAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      since = me?.lastSeenAt
        ? me.lastSeenAt
        : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
    }

    // Pull the freshest 80 items since `since`. We over-fetch slightly so
    // the LLM can group by project; the prompt itself caps inputs.
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        issueId: notifications.issueId,
        projectId: notifications.projectId,
        actorName: users.name,
        issueKey: issues.key,
        issueTitle: issues.title,
        projectKey: projects.key,
        projectName: projects.name,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(issues, eq(notifications.issueId, issues.id))
      .leftJoin(projects, eq(notifications.projectId, projects.id))
      .where(and(eq(notifications.userId, userId), gte(notifications.createdAt, since)))
      .orderBy(desc(notifications.createdAt))
      .limit(80);

    const digestInputs: NotificationDigestInput[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      isRead: r.isRead,
      createdAt: r.createdAt as Date,
      actorName: r.actorName,
      issueId: r.issueId,
      issueKey: r.issueKey,
      issueTitle: r.issueTitle,
      projectKey: r.projectKey,
      projectName: r.projectName,
    }));

    // If AI is globally disabled, return the heuristic digest verbatim. We
    // still return a 200 so the banner has something to render.
    const aiEnabled = await isAiFeatureEnabled();
    if (!aiEnabled || digestInputs.length === 0) {
      const digest = catchMeUpNative({
        since,
        notifications: digestInputs,
        provider: 'native',
        apiKey: null,
        model: null,
      });
      return NextResponse.json({ ...digest, since: since.toISOString(), source: 'native' });
    }

    // Resolve an LLM credential — Anthropic Haiku preferred, OpenAI as
    // fallback if that's what the workspace has wired up. We deliberately
    // do NOT throw when no key is present; the heuristic fills in.
    const [membership] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);

    let provider: 'native' | 'anthropic' | 'openai' = 'native';
    let apiKey: string | null = null;
    let model: string | null = null;

    if (membership?.organizationId) {
      const [org] = await db
        .select({ settings: organizations.settings })
        .from(organizations)
        .where(eq(organizations.id, membership.organizationId))
        .limit(1);
      const orgSettings = (org?.settings as Record<string, unknown> | null) || null;

      const system = await getSystemAgentControlSettingsFromDb();
      const platformStore = system.providerCredentials ?? null;

      const workspace = normalizeWorkspaceAgentSettings(
        (orgSettings as { aiAgents?: unknown })?.aiAgents
      );
      model = workspace.model?.trim() || CATCH_ME_UP_DEFAULT_MODEL;

      const anthropicKey = resolveProviderApiKeyFromSettings(orgSettings, 'anthropic', platformStore);
      if (anthropicKey) {
        provider = 'anthropic';
        apiKey = anthropicKey;
      } else {
        const openaiKey = resolveProviderApiKeyFromSettings(orgSettings, 'openai', platformStore);
        if (openaiKey) {
          provider = 'openai';
          apiKey = openaiKey;
        }
      }
    }

    const digest = await catchMeUp({
      since,
      notifications: digestInputs,
      provider,
      apiKey,
      model,
    });

    return NextResponse.json({
      ...digest,
      since: since.toISOString(),
      source: provider,
    });
  } catch (error) {
    console.error('Failed to build catch-me-up digest:', error);
    return NextResponse.json(
      { error: 'Failed to build catch-me-up digest' },
      { status: 500 }
    );
  }
}
