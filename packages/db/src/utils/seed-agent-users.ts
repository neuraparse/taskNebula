/**
 * Virtual agent users seeder (P0-04 — Linear Agent Protocol).
 *
 * Seeds first-class TaskNebula user rows for each provider in
 * `agent_session_provider`. These rows appear in the assignee picker like
 * humans, but `isAgent=true` flags them as virtual; we never write a password
 * row, and the dispatch endpoint uses `users.agent_provider` to find the
 * matching provider record at runtime.
 *
 * Idempotent: looks up by email and only inserts when absent, then makes sure
 * the row is also a member of the target organization. Safe to call from both
 * the demo seeder and the workspace setup wizard.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema/users';
import { organizationMembers } from '../schema/organizations';

export type AgentProviderHandle = 'claude' | 'codex' | 'cursor' | 'devin' | 'copilot';

interface AgentSpec {
  handle: AgentProviderHandle;
  name: string;
  image: string;
}

const DEFAULT_AGENTS: AgentSpec[] = [
  { handle: 'claude', name: 'Claude (Anthropic)', image: 'https://avatar.vercel.sh/claude' },
  { handle: 'codex', name: 'Codex (OpenAI)', image: 'https://avatar.vercel.sh/codex' },
  { handle: 'cursor', name: 'Cursor', image: 'https://avatar.vercel.sh/cursor' },
  { handle: 'devin', name: 'Devin (Cognition)', image: 'https://avatar.vercel.sh/devin' },
  { handle: 'copilot', name: 'GitHub Copilot', image: 'https://avatar.vercel.sh/copilot' },
];

function emailFor(handle: AgentProviderHandle): string {
  // Use a stable per-handle email under the reserved `agents.tasknebula.local`
  // domain so we never collide with a real user. Auth.js never lets these log
  // in because we don't set a password / OAuth account.
  return `${handle}@agents.tasknebula.local`;
}

/**
 * Ensure each virtual agent user exists and is a member of the given
 * organization. Returns the created/found user ids keyed by handle.
 */
export async function ensureVirtualAgentUsers(
  organizationId: string,
  agents: AgentSpec[] = DEFAULT_AGENTS
): Promise<Record<AgentProviderHandle, string>> {
  const result = {} as Record<AgentProviderHandle, string>;

  for (const spec of agents) {
    const email = emailFor(spec.handle);

    let [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          name: spec.name,
          image: spec.image,
          status: 'active',
          isAgent: true,
          agentProvider: spec.handle,
        })
        .returning({ id: users.id });
      existing = inserted;
    }

    if (!existing) {
      throw new Error(`Failed to seed virtual agent user @${spec.handle}`);
    }

    // Make sure the agent is a member of the workspace so it shows up in the
    // assignee picker (the picker queries organizationMembers).
    const [member] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, existing.id)
        )
      )
      .limit(1);
    if (!member) {
      await db.insert(organizationMembers).values({
        organizationId,
        userId: existing.id,
        role: 'member',
      });
    }

    result[spec.handle] = existing.id;
  }

  return result;
}
