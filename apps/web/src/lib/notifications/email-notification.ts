import {
  BUILTIN_TEMPLATES,
  db,
  emailTemplates,
  emailTemplateTypeEnum,
  notificationPreferences,
  replaceVariables,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

import { sendEmail as sendRawEmail, type SendEmailResult } from '@/lib/email/sender';

type EmailTemplateType = (typeof emailTemplateTypeEnum.enumValues)[number];

const EMAIL_TEMPLATE_TYPES = new Set<string>(emailTemplateTypeEnum?.enumValues ?? []);

const DEFAULT_EMAIL_POLICY: Record<string, boolean> = {
  issue_assigned: true,
  issue_mentioned: true,
  issue_commented: false,
  issue_status_changed: false,
  issue_created: false,
  sprint_started: true,
  sprint_completed: true,
  project_created: false,
  project_archived: false,
  daily_digest: false,
  weekly_digest: false,
};

const EMAIL_PREF_FIELD_BY_EVENT = {
  issue_assigned: 'emailOnAssigned',
  issue_mentioned: 'emailOnMentioned',
  issue_commented: 'emailOnCommented',
  issue_status_changed: 'emailOnStatusChanged',
  issue_created: 'emailOnIssueCreated',
  sprint_started: 'emailOnSprintStarted',
  sprint_completed: 'emailOnSprintCompleted',
  project_created: 'emailOnProjectCreated',
  project_archived: 'emailOnProjectArchived',
} as const;

function isEmailTemplateType(templateType: string): templateType is EmailTemplateType {
  return EMAIL_TEMPLATE_TYPES.has(templateType);
}

function isInDoNotDisturbWindow(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  return start <= end
    ? currentTime >= start && currentTime <= end
    : currentTime >= start || currentTime <= end;
}

export async function shouldSendNotificationEmail(
  userId: string,
  organizationId: string,
  templateType: string
): Promise<boolean> {
  try {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!prefs) return DEFAULT_EMAIL_POLICY[templateType] ?? false;
    if (!prefs.enableEmail) return false;

    if (
      prefs.doNotDisturb &&
      isInDoNotDisturbWindow(prefs.doNotDisturbStart, prefs.doNotDisturbEnd)
    ) {
      return false;
    }

    const field = EMAIL_PREF_FIELD_BY_EVENT[templateType as keyof typeof EMAIL_PREF_FIELD_BY_EVENT];
    if (!field) return DEFAULT_EMAIL_POLICY[templateType] ?? false;

    return Boolean(prefs[field]);
  } catch (error) {
    console.error('Error checking notification email preferences:', error);
    return true;
  }
}

async function getNotificationEmailTemplate(organizationId: string, templateType: string) {
  if (!isEmailTemplateType(templateType)) return null;

  const [orgTemplate] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.organizationId, organizationId),
        eq(emailTemplates.type, templateType),
        eq(emailTemplates.isActive, true)
      )
    )
    .limit(1);

  if (orgTemplate) return orgTemplate;

  const [defaultTemplate] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.type, templateType),
        eq(emailTemplates.isDefault, true),
        eq(emailTemplates.isActive, true)
      )
    )
    .limit(1);

  return defaultTemplate ?? null;
}

export async function renderNotificationEmail(params: {
  organizationId: string;
  templateType: string;
  variables: Record<string, string>;
}): Promise<{ subject: string; html: string; text: string } | null> {
  const template = await getNotificationEmailTemplate(params.organizationId, params.templateType);
  const builtin = BUILTIN_TEMPLATES[params.templateType];

  if (!template && !builtin) return null;

  return {
    subject: replaceVariables(template?.subject ?? builtin!.subject, params.variables),
    html: replaceVariables(template?.htmlBody ?? builtin!.html, params.variables),
    text: replaceVariables(template?.textBody ?? builtin!.text, params.variables),
  };
}

export async function sendNotificationEmail(params: {
  to: string;
  userId: string;
  organizationId: string;
  templateType: string;
  variables: Record<string, string>;
}): Promise<SendEmailResult> {
  try {
    const shouldSend = await shouldSendNotificationEmail(
      params.userId,
      params.organizationId,
      params.templateType
    );

    if (!shouldSend) {
      return { sent: false, skipped: true };
    }

    const rendered = await renderNotificationEmail({
      organizationId: params.organizationId,
      templateType: params.templateType,
      variables: params.variables,
    });

    if (!rendered) {
      return { sent: false, error: `Template not found: ${params.templateType}` };
    }

    return sendRawEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Notification email send failed:', message);
    return { sent: false, error: message };
  }
}
