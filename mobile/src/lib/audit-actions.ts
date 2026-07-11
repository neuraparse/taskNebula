type Translator = (key: string) => string;

const AGENT_RUN_KIND_KEYS: Record<string, string> = {
  backlog_triage: 'admin.agent.runKinds.backlogTriage',
  bulk_sprint_creation: 'admin.agent.runKinds.bulkSprintCreation',
  issue_assist: 'admin.agent.runKinds.issueAssist',
  issue_draft: 'admin.agent.runKinds.issueDraft',
  issue_drafts_multi: 'admin.agent.runKinds.issueDraftsMulti',
  project_tracking: 'admin.agent.runKinds.projectTracking',
  sprint_planning: 'admin.agent.runKinds.sprintPlanning',
};

function translatedOrCode(value: string, key: string | undefined, t: Translator): string {
  if (!key) return value;
  const translated = t(key);
  return translated && translated !== key ? translated : value;
}

export function auditActionLabel(action: string): string {
  return action;
}

export function agentRunKindLabel(kind: string, t: Translator): string {
  return translatedOrCode(kind, AGENT_RUN_KIND_KEYS[kind], t);
}
