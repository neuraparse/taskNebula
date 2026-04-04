import {
  agentModelConfigRevisions,
  agentModelConfigs,
  db,
  eq,
  organizations,
} from '@tasknebula/db';
import { and, count, desc, inArray } from 'drizzle-orm';
import type { AgentProvider, WorkspaceAgentSettings } from './config';
import {
  getModelMaxOutputTokensLimit,
  getSupportedReasoningOptions,
  type AgentReasoningEffort,
} from './model-catalog';

export type AgentModelConfigSettings = {
  temperature: number | null;
  maxOutputTokens: number | null;
  reasoningEffort: AgentReasoningEffort | null;
  notes: string | null;
};

export type AgentModelConfigRecord = {
  id: string;
  organizationId: string;
  name: string;
  provider: AgentProvider;
  model: string;
  description: string | null;
  settings: AgentModelConfigSettings;
  isDefault: boolean;
  isArchived: boolean;
  revisionCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type DbExecutor = typeof db;

function clampNumber(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.min(Math.max(value, min), max);
}

export function normalizeAgentModelConfigSettings(
  input: unknown,
  options?: { provider?: AgentProvider; model?: string }
): AgentModelConfigSettings {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  const provider = options?.provider || 'openai';
  const model = options?.model || '';
  const supportedReasoningOptions = getSupportedReasoningOptions(provider, model).filter(
    (option): option is AgentReasoningEffort => option !== 'none'
  );
  const maxOutputTokensLimit = getModelMaxOutputTokensLimit(provider, model);

  return {
    temperature: clampNumber(source.temperature, 0, 2),
    maxOutputTokens: clampNumber(source.maxOutputTokens, 32, maxOutputTokensLimit),
    reasoningEffort:
      typeof source.reasoningEffort === 'string' && supportedReasoningOptions.includes(source.reasoningEffort as AgentReasoningEffort)
        ? source.reasoningEffort as AgentReasoningEffort
        : null,
    notes: typeof source.notes === 'string' && source.notes.trim() ? source.notes.trim() : null,
  };
}

export function extractWorkspaceModelConfigId(
  settings: Record<string, unknown> | null | undefined
) {
  const aiAgents =
    settings && typeof settings.aiAgents === 'object' && settings.aiAgents !== null
      ? (settings.aiAgents as Record<string, unknown>)
      : null;

  return typeof aiAgents?.modelConfigId === 'string' && aiAgents.modelConfigId.trim()
    ? aiAgents.modelConfigId.trim()
    : null;
}

function buildModelConfigSnapshot(config: {
  name: string;
  provider: AgentProvider;
  model: string;
  description: string | null;
  settings: AgentModelConfigSettings;
  isDefault: boolean;
  isArchived: boolean;
}) {
  return {
    name: config.name,
    provider: config.provider,
    model: config.model,
    description: config.description,
    settings: config.settings,
    isDefault: config.isDefault,
    isArchived: config.isArchived,
  };
}

async function listRevisionCounts(configIds: string[]) {
  if (configIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      configId: agentModelConfigRevisions.configId,
      total: count(),
    })
    .from(agentModelConfigRevisions)
    .where(inArray(agentModelConfigRevisions.configId, configIds))
    .groupBy(agentModelConfigRevisions.configId);

  return new Map(rows.map((row) => [row.configId, Number(row.total || 0)]));
}

function mapConfigRecord(
  row: typeof agentModelConfigs.$inferSelect,
  revisionCount: number
): AgentModelConfigRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    provider: row.provider,
    model: row.model,
    description: row.description,
    settings: normalizeAgentModelConfigSettings(row.settings, {
      provider: row.provider,
      model: row.model,
    }),
    isDefault: row.isDefault,
    isArchived: row.isArchived,
    revisionCount,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAgentModelConfigs(
  organizationId: string,
  options?: { includeArchived?: boolean }
) {
  const includeArchived = options?.includeArchived ?? false;
  const rows = await db
    .select()
    .from(agentModelConfigs)
    .where(
      includeArchived
        ? eq(agentModelConfigs.organizationId, organizationId)
        : and(eq(agentModelConfigs.organizationId, organizationId), eq(agentModelConfigs.isArchived, false))
    )
    .orderBy(desc(agentModelConfigs.isDefault), agentModelConfigs.name);

  const revisionCounts = await listRevisionCounts(rows.map((row) => row.id));

  return rows.map((row) => mapConfigRecord(row, revisionCounts.get(row.id) || 0));
}

export async function getAgentModelConfigById(organizationId: string, configId: string) {
  const [row] = await db
    .select()
    .from(agentModelConfigs)
    .where(and(eq(agentModelConfigs.organizationId, organizationId), eq(agentModelConfigs.id, configId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const [revisionRow] = await db
    .select({ total: count() })
    .from(agentModelConfigRevisions)
    .where(eq(agentModelConfigRevisions.configId, configId));

  return mapConfigRecord(row, Number(revisionRow?.total || 0));
}

async function getNextRevision(executor: DbExecutor, configId: string) {
  const [latest] = await executor
    .select({ revision: agentModelConfigRevisions.revision })
    .from(agentModelConfigRevisions)
    .where(eq(agentModelConfigRevisions.configId, configId))
    .orderBy(desc(agentModelConfigRevisions.revision))
    .limit(1);

  return (latest?.revision || 0) + 1;
}

export async function createAgentModelConfig(params: {
  organizationId: string;
  userId: string;
  name: string;
  provider: AgentProvider;
  model: string;
  description?: string | null;
  settings?: unknown;
  isDefault?: boolean;
}) {
  const nextSettings = normalizeAgentModelConfigSettings(params.settings, {
    provider: params.provider,
    model: params.model,
  });
  const nextDescription = params.description?.trim() || null;

  const [config] = await db.transaction(async (tx) => {
    if (params.isDefault) {
      await tx
        .update(agentModelConfigs)
        .set({
          isDefault: false,
          updatedAt: new Date(),
          updatedBy: params.userId,
        })
        .where(eq(agentModelConfigs.organizationId, params.organizationId));
    }

    const [created] = await tx
      .insert(agentModelConfigs)
      .values({
        organizationId: params.organizationId,
        name: params.name.trim(),
        provider: params.provider,
        model: params.model.trim(),
        description: nextDescription,
        settings: nextSettings,
        isDefault: Boolean(params.isDefault),
        createdBy: params.userId,
        updatedBy: params.userId,
      })
      .returning();

    await tx.insert(agentModelConfigRevisions).values({
      configId: created.id,
      organizationId: params.organizationId,
      revision: 1,
      snapshot: buildModelConfigSnapshot({
        name: created.name,
        provider: created.provider,
        model: created.model,
        description: created.description,
        settings: nextSettings,
        isDefault: created.isDefault,
        isArchived: created.isArchived,
      }),
      changedBy: params.userId,
    });

    return [created];
  });

  return getAgentModelConfigById(params.organizationId, config.id);
}

export async function updateAgentModelConfig(params: {
  organizationId: string;
  configId: string;
  userId: string;
  name: string;
  provider: AgentProvider;
  model: string;
  description?: string | null;
  settings?: unknown;
  isDefault?: boolean;
  isArchived?: boolean;
}) {
  const current = await getAgentModelConfigById(params.organizationId, params.configId);
  if (!current) {
    return null;
  }

  const nextSettings = normalizeAgentModelConfigSettings(params.settings, {
    provider: params.provider,
    model: params.model,
  });
  const nextDescription = params.description?.trim() || null;

  await db.transaction(async (tx) => {
    if (params.isDefault) {
      await tx
        .update(agentModelConfigs)
        .set({
          isDefault: false,
          updatedAt: new Date(),
          updatedBy: params.userId,
        })
        .where(and(eq(agentModelConfigs.organizationId, params.organizationId), eq(agentModelConfigs.isDefault, true)));
    }

    const [updated] = await tx
      .update(agentModelConfigs)
      .set({
        name: params.name.trim(),
        provider: params.provider,
        model: params.model.trim(),
        description: nextDescription,
        settings: nextSettings,
        isDefault: params.isDefault ?? current.isDefault,
        isArchived: params.isArchived ?? current.isArchived,
        updatedAt: new Date(),
        updatedBy: params.userId,
      })
      .where(and(eq(agentModelConfigs.organizationId, params.organizationId), eq(agentModelConfigs.id, params.configId)))
      .returning();

    const nextRevision = await getNextRevision(tx, params.configId);
    await tx.insert(agentModelConfigRevisions).values({
      configId: params.configId,
      organizationId: params.organizationId,
      revision: nextRevision,
      snapshot: buildModelConfigSnapshot({
        name: updated.name,
        provider: updated.provider,
        model: updated.model,
        description: updated.description,
        settings: nextSettings,
        isDefault: updated.isDefault,
        isArchived: updated.isArchived,
      }),
      changedBy: params.userId,
    });
  });

  return getAgentModelConfigById(params.organizationId, params.configId);
}

export async function listAgentModelConfigsByIds(configIds: string[]) {
  if (configIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(agentModelConfigs)
    .where(inArray(agentModelConfigs.id, configIds));
  const revisionCounts = await listRevisionCounts(rows.map((row) => row.id));

  return rows.map((row) => mapConfigRecord(row, revisionCounts.get(row.id) || 0));
}

export async function resolveWorkspaceModelConfig(
  organizationId: string,
  workspaceSettings: WorkspaceAgentSettings
) {
  if (!workspaceSettings.modelConfigId) {
    return null;
  }

  return getAgentModelConfigById(organizationId, workspaceSettings.modelConfigId);
}

export async function applyWorkspaceModelConfig(params: {
  organizationId: string;
  workspaceSettings: WorkspaceAgentSettings;
}) {
  const selectedModelConfig = await resolveWorkspaceModelConfig(
    params.organizationId,
    params.workspaceSettings
  );

  if (!selectedModelConfig) {
    return {
      workspaceSettings: params.workspaceSettings,
      selectedModelConfig: null,
    };
  }

  return {
    workspaceSettings: {
      ...params.workspaceSettings,
      provider: selectedModelConfig.provider,
      model: selectedModelConfig.model,
      modelConfigId: selectedModelConfig.id,
    },
    selectedModelConfig,
  };
}

export async function getOrganizationModelConfigSummary(organizationId: string) {
  const configs = await listAgentModelConfigs(organizationId, { includeArchived: true });
  const selectedOrganization = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const workspaceSettings = selectedOrganization[0]?.settings as Record<string, unknown> | null;
  const selectedModelConfigId = extractWorkspaceModelConfigId(workspaceSettings);

  return {
    configs,
    selectedModelConfig: selectedModelConfigId
      ? configs.find((config) => config.id === selectedModelConfigId) || null
      : null,
  };
}
