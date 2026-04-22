import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, eq, organizations } from '@tasknebula/db';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import {
  getProviderCredentialStatusFromSettings,
  type AgentProviderCredentialStatus,
} from '@/lib/agents/credentials';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';
import type { AgentProvider } from '@/lib/agents/config';

export const dynamic = 'force-dynamic';

type CapabilityResponse = {
  platformEnabled: boolean;
  // LLM Provider (shared by AI Assistant + Agents)
  llm: {
    provider: AgentProvider;
    model: string;
    configured: boolean;
    source: AgentProviderCredentialStatus['source'];
  };
  // AI Assistant — on-demand features (draft issue, suggestions)
  assistantEnabled: boolean;
  canDraft: boolean;
  // Agents — automated run kinds (tracking, triage, sprint planning)
  agentsEnabled: boolean;
  canRunAgents: boolean;
};

function disabledShape(): CapabilityResponse {
  return {
    platformEnabled: false,
    llm: {
      provider: 'native',
      model: '',
      configured: false,
      source: null,
    },
    assistantEnabled: false,
    canDraft: false,
    agentsEnabled: false,
    canRunAgents: false,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(disabledShape());
  }

  const system = await getSystemAgentControlSettingsFromDb().catch(() => null);
  const platformEnabled = system?.globalEnabled === true;
  if (!platformEnabled) {
    return NextResponse.json(disabledShape());
  }

  if (!organizationId) {
    // Caller hasn't selected an org yet — surface platform state only.
    return NextResponse.json({
      ...disabledShape(),
      platformEnabled: true,
    });
  }

  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    return NextResponse.json({ ...disabledShape(), platformEnabled: true });
  }

  const orgSettings = (org.settings as Record<string, unknown> | null) || null;
  const workspace = normalizeWorkspaceAgentSettings(
    (orgSettings as { aiAgents?: unknown })?.aiAgents
  );

  const platformStore = system?.providerCredentials ?? null;
  const credStatus = getProviderCredentialStatusFromSettings(
    orgSettings,
    workspace.provider,
    platformStore
  );

  const hasCredential = credStatus.configured === true;

  return NextResponse.json<CapabilityResponse>({
    platformEnabled: true,
    llm: {
      provider: workspace.provider,
      model: workspace.model,
      configured: hasCredential,
      source: credStatus.source,
    },
    assistantEnabled: workspace.assistantEnabled === true,
    canDraft: workspace.assistantEnabled === true && hasCredential,
    agentsEnabled: workspace.enabled === true,
    canRunAgents: workspace.enabled === true && hasCredential,
  });
}
