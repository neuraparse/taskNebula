const RUN_KIND_KEYS = new Set([
  'project_tracking',
  'backlog_triage',
  'sprint_planning',
  'bulk_sprint_creation',
]);

type RunKindTranslator = (key: string, values?: Record<string, string | number>) => string;

export function formatAgentRunKind(kind: string, t: RunKindTranslator): string {
  if (RUN_KIND_KEYS.has(kind)) {
    return t(kind);
  }

  return t('unknown', { kind });
}
