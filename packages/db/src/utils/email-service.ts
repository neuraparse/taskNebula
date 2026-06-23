import { db } from '../index';
import { emailTemplateTypeEnum, emailTemplates, notificationPreferences } from '../schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import {
  renderShell,
  quoteBlock,
  infoCard,
  chip,
  actorRow,
  statGrid,
  divider,
  sectionHeading,
  bulletList,
  EMAIL_COLORS,
  metaRow,
  metaTable,
  paragraph,
  textFooter,
} from './email-layout';

/**
 * Email Service
 *
 * Handles email sending with template rendering and user preferences.
 * Uses SMTP (Nodemailer) for email delivery.
 *
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, EMAIL_FROM
 *
 * Features:
 * - SMTP transport with connection pooling
 * - Template variable replacement
 * - User preference checking
 * - Do not disturb mode
 * - HTML and plain text versions
 * - Fallback to default templates
 */

export interface EmailParams {
  to: string;
  templateType: string;
  variables: Record<string, string>;
  organizationId: string;
  userId?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

type EmailTemplateType = (typeof emailTemplateTypeEnum.enumValues)[number];

const EMAIL_TEMPLATE_TYPES = new Set<string>(emailTemplateTypeEnum.enumValues);

function isEmailTemplateType(templateType: string): templateType is EmailTemplateType {
  return EMAIL_TEMPLATE_TYPES.has(templateType);
}

/**
 * Built-in fallback templates used when no DB templates exist.
 * These ensure emails work out of the box without seeding.
 */
// Built-in email templates (email-safe HTML: tables, inline styles only).
// Shared fragments are composed through email-layout.ts so every runtime
// notification uses the same IBM Modern / Carbon-inspired visual system.

export const BUILTIN_TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  issue_assigned: {
    subject: '[{{projectName}}] {{issueKey}} assigned to you — {{issueTitle}}',
    html: renderShell({
      preheader: '{{actorName}} assigned {{issueKey}} to you in {{projectName}}.',
      kicker: 'ASSIGNMENT',
      heading: '{{issueTitle}}',
      body:
        paragraph(
          `{{actorName}} assigned <strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong> to you.`
        ) +
        actorRow({ name: '{{actorName}}', action: 'Assigned this issue to you' }) +
        metaTable(
          metaRow('Issue', `<strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>`) +
            metaRow('Project', '{{projectName}}') +
            metaRow('Priority', chip('{{priority}}', { tone: 'warning' }))
        ),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} assigned {{issueKey}} to you.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}' +
      textFooter(),
  },

  issue_mentioned: {
    subject: '@mention: {{issueKey}} in {{projectName}}',
    html: renderShell({
      preheader: '{{actorName}} mentioned you in {{issueKey}} — {{issueTitle}}.',
      kicker: 'MENTION',
      heading: '{{actorName}} mentioned you',
      body:
        paragraph(
          `You were mentioned in <strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong> &mdash; {{issueTitle}}.`
        ) +
        actorRow({ name: '{{actorName}}', action: 'Mentioned you in a thread' }) +
        metaTable(
          metaRow('Issue', `<strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>`) +
            metaRow('Project', '{{projectName}}')
        ),
      ctaLabel: 'Open thread',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} mentioned you in {{issueKey}}: {{issueTitle}}\n\n' +
      'Project: {{projectName}}\n\n' +
      'Open: {{issueUrl}}' +
      textFooter(),
  },

  issue_commented: {
    subject: '{{actorName}} commented on {{issueKey}}',
    html: renderShell({
      preheader: '{{actorName}} left a new comment on {{issueKey}}.',
      kicker: 'COMMENT',
      heading: '{{issueTitle}}',
      body:
        paragraph(
          `{{actorName}} commented on <strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>.`
        ) +
        actorRow({ name: '{{actorName}}', action: 'Added a new comment' }) +
        quoteBlock('{{commentBody}}') +
        metaTable(
          metaRow('Issue', `<strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>`) +
            metaRow('Project', '{{projectName}}')
        ),
      ctaLabel: 'Reply in thread',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} commented on {{issueKey}}: {{issueTitle}}\n\n' +
      '"{{commentBody}}"\n\n' +
      'Project: {{projectName}}\n\n' +
      'Reply: {{issueUrl}}' +
      textFooter(),
  },

  issue_status_changed: {
    subject: '[{{projectName}}] {{issueKey}} → {{newStatus}}',
    html: renderShell({
      preheader: '{{actorName}} moved {{issueKey}} to {{newStatus}}.',
      kicker: 'STATUS CHANGE',
      heading: '{{issueTitle}}',
      body:
        paragraph(
          `{{actorName}} moved <strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong> to ` +
            chip('{{newStatus}}', { tone: 'info' }) +
            '.'
        ) +
        actorRow({ name: '{{actorName}}', action: 'Updated the issue status' }) +
        metaTable(
          metaRow('Issue', `<strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>`) +
            metaRow('Project', '{{projectName}}') +
            metaRow('New status', chip('{{newStatus}}', { tone: 'success' }))
        ),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} moved {{issueKey}} to {{newStatus}}.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}' +
      textFooter(),
  },

  issue_created: {
    subject: '[{{projectName}}] New issue {{issueKey}} — {{issueTitle}}',
    html: renderShell({
      preheader: 'New issue {{issueKey}} created in {{projectName}}.',
      kicker: 'NEW ISSUE',
      heading: '{{issueTitle}}',
      body:
        paragraph(
          `{{actorName}} created <strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong> and assigned it to you.`
        ) +
        actorRow({ name: '{{actorName}}', action: 'Created this issue' }) +
        metaTable(
          metaRow('Issue', `<strong style="color:${EMAIL_COLORS.heading};">{{issueKey}}</strong>`) +
            metaRow('Project', '{{projectName}}') +
            metaRow('Priority', chip('{{priority}}', { tone: 'warning' }))
        ),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} created {{issueKey}} and assigned it to you.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}' +
      textFooter(),
  },

  sprint_started: {
    subject: 'Sprint {{sprintName}} started in {{projectName}}',
    html: renderShell({
      preheader: 'Sprint {{sprintName}} is now running in {{projectName}}.',
      kicker: 'SPRINT STARTED',
      heading: '{{sprintName}}',
      body:
        paragraph(
          `{{actorName}} started a new sprint in <strong style="color:${EMAIL_COLORS.heading};">{{projectName}}</strong>.`
        ) +
        paragraph('{{sprintGoal}}', { muted: true, spacingTop: 12 }) +
        statGrid([
          { value: '{{sprintStartDate}}', label: 'Starts', tone: 'brand' },
          { value: '{{sprintEndDate}}', label: 'Ends' },
          { value: '{{issueCount}}', label: 'Issues', tone: 'brand' },
        ]) +
        metaTable(
          metaRow(
            'Sprint',
            `<strong style="color:${EMAIL_COLORS.heading};">{{sprintName}}</strong>`
          ) +
            metaRow('Project', '{{projectName}}') +
            metaRow('Dates', '{{sprintStartDate}} &rarr; {{sprintEndDate}}') +
            metaRow('Issues', '{{issueCount}}')
        ),
      ctaLabel: 'Open sprint',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      'Sprint started: {{sprintName}}\n\n' +
      'Goal: {{sprintGoal}}\n' +
      'Dates: {{sprintStartDate}} -> {{sprintEndDate}}\n' +
      'Issues: {{issueCount}}\n' +
      'Project: {{projectName}}\n\n' +
      'Open: {{issueUrl}}' +
      textFooter(),
  },

  project_created: {
    subject: 'New project {{projectName}} in {{organizationName}}',
    html: renderShell({
      preheader: '{{actorName}} created {{projectName}} in {{organizationName}}.',
      kicker: 'NEW PROJECT',
      heading: '{{projectName}}',
      body:
        paragraph(
          `{{actorName}} created a new project in <strong style="color:${EMAIL_COLORS.heading};">{{organizationName}}</strong>.`
        ) +
        infoCard({ tone: 'info', title: 'ABOUT THIS PROJECT', body: '{{projectDescription}}' }) +
        metaTable(
          metaRow(
            'Project',
            `<strong style="color:${EMAIL_COLORS.heading};">{{projectName}}</strong>`
          ) +
            metaRow('Key', '{{projectKey}}') +
            metaRow('Created by', '{{actorName}}') +
            metaRow('Organization', '{{organizationName}}')
        ),
      ctaLabel: 'Open project',
      ctaUrl: '{{projectUrl}}',
    }),
    text:
      '{{actorName}} created a new project: {{projectName}}\n\n' +
      '{{projectDescription}}\n\n' +
      'Key: {{projectKey}}\n' +
      'Organization: {{organizationName}}\n\n' +
      'Open: {{projectUrl}}' +
      textFooter(),
  },

  project_archived: {
    subject: 'Project {{projectName}} archived',
    html: renderShell({
      preheader: '{{projectName}} has been archived by {{actorName}}.',
      kicker: 'PROJECT ARCHIVED',
      heading: '{{projectName}}',
      body:
        paragraph(
          `{{actorName}} archived <strong style="color:${EMAIL_COLORS.heading};">{{projectName}}</strong> on {{archivedAt}}.`
        ) +
        infoCard({
          tone: 'warning',
          title: 'READ-ONLY NOTE',
          body: 'The project is now read-only for most members. Reach out to an admin if this was unexpected.',
        }) +
        metaTable(
          metaRow(
            'Project',
            `<strong style="color:${EMAIL_COLORS.heading};">{{projectName}}</strong>`
          ) +
            metaRow('Archived by', '{{actorName}}') +
            metaRow('Archived on', '{{archivedAt}}') +
            metaRow('Organization', '{{organizationName}}')
        ),
      ctaLabel: 'View project',
      ctaUrl: '{{projectUrl}}',
    }),
    text:
      '{{actorName}} archived the project {{projectName}} on {{archivedAt}}.\n\n' +
      'Organization: {{organizationName}}\n\n' +
      'View: {{projectUrl}}' +
      textFooter(),
  },

  sprint_completed: {
    subject: 'Sprint {{sprintName}} completed',
    html: renderShell({
      preheader: 'Sprint {{sprintName}} wrapped up in {{projectName}}.',
      kicker: 'SPRINT COMPLETED',
      heading: '{{sprintName}}',
      body:
        paragraph(
          `{{actorName}} closed the sprint in <strong style="color:${EMAIL_COLORS.heading};">{{projectName}}</strong>. Here's the recap.`
        ) +
        statGrid([
          { value: '{{issueCount}}', label: 'Total' },
          { value: '{{completedCount}}', label: 'Completed', tone: 'success' },
          { value: '{{carriedOverCount}}', label: 'Carried over' },
        ]) +
        metaTable(
          metaRow(
            'Sprint',
            `<strong style="color:${EMAIL_COLORS.heading};">{{sprintName}}</strong>`
          ) +
            metaRow('Project', '{{projectName}}') +
            metaRow('Dates', '{{sprintStartDate}} &rarr; {{sprintEndDate}}') +
            metaRow('Total issues', '{{issueCount}}') +
            metaRow('Completed', '{{completedCount}}') +
            metaRow('Carried over', '{{carriedOverCount}}')
        ),
      ctaLabel: 'View retrospective',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      'Sprint completed: {{sprintName}}\n\n' +
      'Dates: {{sprintStartDate}} -> {{sprintEndDate}}\n' +
      'Total issues: {{issueCount}}\n' +
      'Completed: {{completedCount}}\n' +
      'Carried over: {{carriedOverCount}}\n' +
      'Project: {{projectName}}\n\n' +
      'Retrospective: {{issueUrl}}' +
      textFooter(),
  },

  daily_digest: {
    subject: 'Your daily digest — {{period}}',
    html: renderShell({
      preheader: 'Your {{period}} digest across {{organizationName}}.',
      kicker: 'DAILY DIGEST',
      heading: "Here's what happened today",
      body:
        paragraph(
          `A quick recap of activity across <strong style="color:${EMAIL_COLORS.heading};">{{organizationName}}</strong> for {{period}}.`
        ) +
        sectionHeading("Today's activity") +
        statGrid([
          { value: '{{issueCount}}', label: 'Issues', tone: 'brand' },
          { value: '{{completedCount}}', label: 'Completed', tone: 'success' },
          { value: '{{commentCount}}', label: 'Comments' },
        ]) +
        divider() +
        infoCard({ tone: 'neutral', title: 'ACTIVITY', body: '{{activityList}}' }) +
        bulletList(['{{issuesSummary}}']),
      ctaLabel: 'Open TaskNebula',
      ctaUrl: '{{appUrl}}',
    }),
    text:
      'Daily digest — {{period}}\n\n' +
      '{{activityList}}\n\n' +
      '{{issuesSummary}}\n\n' +
      'Open: {{appUrl}}' +
      textFooter(),
  },

  weekly_digest: {
    subject: 'Your weekly digest — {{period}}',
    html: renderShell({
      preheader: 'Your weekly summary for {{organizationName}} ({{period}}).',
      kicker: 'WEEKLY DIGEST',
      heading: 'This week in {{organizationName}}',
      body:
        paragraph('A summary of activity for {{period}}.') +
        sectionHeading('This week') +
        statGrid([
          { value: '{{issueCount}}', label: 'Issues', tone: 'brand' },
          { value: '{{completedCount}}', label: 'Completed', tone: 'success' },
          { value: '{{commentCount}}', label: 'Comments' },
        ]) +
        divider() +
        infoCard({ tone: 'neutral', title: 'ACTIVITY', body: '{{activityList}}' }) +
        bulletList(['{{issuesSummary}}']),
      ctaLabel: 'Open TaskNebula',
      ctaUrl: '{{appUrl}}',
    }),
    text:
      'Weekly digest — {{period}}\n\n' +
      '{{activityList}}\n\n' +
      '{{issuesSummary}}\n\n' +
      'Open: {{appUrl}}' +
      textFooter(),
  },
};

/**
 * Replace template variables with actual values
 *
 * Example:
 * replaceVariables("Hello {{userName}}", { userName: "John" }) => "Hello John"
 */
export function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * Check if user should receive email based on preferences
 */
async function shouldSendEmail(
  userId: string,
  organizationId: string,
  eventType: string
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
      );

    // Quiet-by-default policy: critical direct events and sprint lifecycle
    // milestones are on; noisy activity and project lifecycle emails are opt-in.
    const DEFAULT_EVENT_POLICY: Record<string, boolean> = {
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

    // No prefs row yet → fall back to the same policy (NOT blanket true).
    if (!prefs) return DEFAULT_EVENT_POLICY[eventType] ?? false;

    // Master switch off → never send.
    if (!prefs.enableEmail) return false;

    // Do not disturb — supports both same-day and overnight ranges.
    if (prefs.doNotDisturb && prefs.doNotDisturbStart && prefs.doNotDisturbEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const start = prefs.doNotDisturbStart;
      const end = prefs.doNotDisturbEnd;
      const inWindow =
        start <= end
          ? currentTime >= start && currentTime <= end
          : currentTime >= start || currentTime <= end; // overnight (e.g. 22:00–08:00)
      if (inWindow) return false;
    }

    // Per-event override from the user's stored prefs.
    const eventPreferenceMap: Record<string, boolean> = {
      issue_assigned: prefs.emailOnAssigned,
      issue_mentioned: prefs.emailOnMentioned,
      issue_commented: prefs.emailOnCommented,
      issue_status_changed: prefs.emailOnStatusChanged,
      issue_created: prefs.emailOnIssueCreated,
      sprint_started: prefs.emailOnSprintStarted,
      sprint_completed: prefs.emailOnSprintCompleted,
      project_created: prefs.emailOnProjectCreated,
      project_archived: prefs.emailOnProjectArchived,
    };

    // If the event isn't in the map, fall back to the quiet policy.
    return eventPreferenceMap[eventType] ?? DEFAULT_EVENT_POLICY[eventType] ?? false;
  } catch (error) {
    console.error('Error checking email preferences:', error);
    // On error, default to sending email
    return true;
  }
}

/**
 * Get email template by type
 *
 * Tries to find organization-specific template first,
 * falls back to default template if not found.
 */
async function getTemplate(organizationId: string, templateType: string) {
  if (!isEmailTemplateType(templateType)) {
    return null;
  }

  try {
    // Try organization-specific template first
    const [orgTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.organizationId, organizationId),
          eq(emailTemplates.type, templateType),
          eq(emailTemplates.isActive, true)
        )
      );

    if (orgTemplate) return orgTemplate;

    // Fall back to default template
    const [defaultTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.type, templateType),
          eq(emailTemplates.isDefault, true),
          eq(emailTemplates.isActive, true)
        )
      );

    return defaultTemplate;
  } catch (error) {
    console.error('Error fetching email template:', error);
    return null;
  }
}

// Lazy-initialized SMTP transporter (created on first use)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) return null; // Email disabled if no SMTP_HOST

  const port = parseInt(process.env.SMTP_PORT || '25', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
    // Connection pooling for performance
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Timeouts
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    // Don't fail on invalid certs (internal mail servers)
    tls: { rejectUnauthorized: false },
  });

  return transporter;
}

/**
 * Send email using template and SMTP transport.
 * Respects user notification preferences and do-not-disturb mode.
 * No-op if SMTP_HOST is not configured.
 */
export async function sendEmail(params: EmailParams): Promise<SendEmailResult> {
  try {
    const smtp = getTransporter();
    if (!smtp) {
      // SMTP not configured - silently skip
      return { success: true, messageId: 'email-disabled' };
    }

    // Check user preferences if userId provided
    if (params.userId) {
      const shouldSend = await shouldSendEmail(
        params.userId,
        params.organizationId,
        params.templateType
      );

      if (!shouldSend) {
        return { success: true, messageId: 'skipped-by-preferences' };
      }
    }

    // Get template from DB, fall back to built-in templates
    const template = await getTemplate(params.organizationId, params.templateType);
    const builtin = BUILTIN_TEMPLATES[params.templateType];

    if (!template && !builtin) {
      console.warn(`No email template found for type: ${params.templateType}`);
      return { success: false, error: 'Template not found' };
    }

    // Replace variables in subject and body
    const subject = replaceVariables(template?.subject ?? builtin!.subject, params.variables);
    const htmlBody = replaceVariables(template?.htmlBody ?? builtin!.html, params.variables);
    const textBody = replaceVariables(template?.textBody ?? builtin!.text, params.variables);

    const from = process.env.EMAIL_FROM || 'TaskNebula <noreply@localhost>';

    const info = await smtp.sendMail({
      from,
      to: params.to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log('📧 Email sent:', { to: params.to, subject, messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send notification email for issue events
 *
 * Helper function to send emails for common issue events
 */
export async function sendIssueNotificationEmail(params: {
  to: string;
  userId: string;
  organizationId: string;
  eventType:
    | 'issue_assigned'
    | 'issue_mentioned'
    | 'issue_commented'
    | 'issue_status_changed'
    | 'issue_created';
  issueKey: string;
  issueTitle: string;
  issueUrl: string;
  actorName: string;
  projectName: string;
  additionalVariables?: Record<string, string>;
}): Promise<SendEmailResult> {
  const variables: Record<string, string> = {
    userName: params.to.split('@')[0] || 'User', // Simple fallback
    issueKey: params.issueKey,
    issueTitle: params.issueTitle,
    issueUrl: params.issueUrl,
    actorName: params.actorName,
    projectName: params.projectName,
    organizationName: params.organizationId,
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/settings/notifications`,
    ...params.additionalVariables,
  };

  return sendEmail({
    to: params.to,
    templateType: params.eventType,
    variables,
    organizationId: params.organizationId,
    userId: params.userId,
  });
}

/**
 * Recipient for a project lifecycle notification email.
 * `userId` is required so we can gate by the recipient's preferences.
 */
export interface ProjectNotificationRecipient {
  userId: string;
  email: string;
  name?: string | null;
}

/**
 * Sprint lifecycle recipient input. Same shape as ProjectNotificationRecipient —
 * kept as a separate alias so call-sites remain readable.
 */
export type SprintNotificationRecipient = ProjectNotificationRecipient;

/**
 * Send project-lifecycle notification emails (`project.created`,
 * `project.archived`) to a list of recipients, gating each one by their
 * stored notification preferences.
 *
 * This helper is intentionally resilient: it never throws. Individual send
 * failures are logged and returned in the results array so callers can
 * fire-and-forget without handling per-recipient errors.
 */
export async function sendProjectNotificationEmail(params: {
  project: {
    id: string;
    name: string;
    key?: string | null;
    description?: string | null;
  };
  organization: {
    id: string;
    name: string;
  };
  eventType: 'project.created' | 'project.archived';
  actorName: string;
  archivedAt?: string;
  recipients: ReadonlyArray<ProjectNotificationRecipient>;
}): Promise<SendEmailResult[]> {
  const templateType =
    params.eventType === 'project.created' ? 'project_created' : 'project_archived';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const projectUrl = `${appUrl}/projects/${params.project.key || params.project.id}`;
  const unsubscribeUrl = `${appUrl}/settings/notifications`;
  const archivedAt = params.archivedAt || new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    params.recipients.map(async (recipient): Promise<SendEmailResult> => {
      try {
        return await sendEmail({
          to: recipient.email,
          templateType,
          organizationId: params.organization.id,
          userId: recipient.userId,
          variables: {
            userName: recipient.name || recipient.email.split('@')[0] || 'there',
            projectName: params.project.name,
            projectKey: params.project.key || '',
            projectDescription: params.project.description || 'No description provided yet.',
            projectUrl,
            organizationName: params.organization.name,
            actorName: params.actorName,
            archivedAt,
            appUrl,
            unsubscribeUrl,
          },
        });
      } catch (error) {
        console.error('sendProjectNotificationEmail recipient failed:', error);
        return { success: false, error: String(error) };
      }
    })
  );

  return results;
}

/**
 * Send notification emails for a sprint lifecycle event to many recipients.
 * Individual failures are logged and captured in the results array so callers
 * can fire-and-forget without handling per-recipient errors.
 */
export async function sendSprintNotificationEmail(params: {
  sprint: {
    id: string;
    name: string;
    goal?: string | null;
    startDate: Date | string;
    endDate: Date | string;
  };
  project: {
    id: string;
    key: string;
    name: string;
    organizationId: string;
  };
  eventType: 'sprint.started' | 'sprint.completed';
  recipients: ReadonlyArray<SprintNotificationRecipient>;
  actorName?: string;
  stats?: {
    issueCount?: number;
    completedCount?: number;
    carriedOverCount?: number;
  };
  sprintUrl?: string;
}): Promise<SendEmailResult[]> {
  const templateType =
    params.eventType === 'sprint.started' ? 'sprint_started' : 'sprint_completed';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const sprintUrl =
    params.sprintUrl || `${appUrl}/projects/${params.project.key}/sprints/${params.sprint.id}`;

  const fmtDate = (d: Date | string): string => {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const baseVariables: Record<string, string> = {
    sprintName: params.sprint.name,
    sprintGoal: params.sprint.goal || '',
    sprintStartDate: fmtDate(params.sprint.startDate),
    sprintEndDate: fmtDate(params.sprint.endDate),
    projectName: params.project.name,
    projectKey: params.project.key,
    actorName: params.actorName || 'A teammate',
    issueCount: String(params.stats?.issueCount ?? 0),
    completedCount: String(params.stats?.completedCount ?? 0),
    carriedOverCount: String(params.stats?.carriedOverCount ?? 0),
    issueUrl: sprintUrl,
    organizationName: params.project.organizationId,
    appUrl,
    unsubscribeUrl: `${appUrl}/settings/notifications`,
  };

  const results: SendEmailResult[] = [];
  for (const recipient of params.recipients) {
    const variables: Record<string, string> = {
      ...baseVariables,
      recipientName: recipient.name || recipient.email.split('@')[0] || recipient.email,
    };
    try {
      const result = await sendEmail({
        to: recipient.email,
        templateType,
        variables,
        organizationId: params.project.organizationId,
        userId: recipient.userId,
      });
      results.push(result);
    } catch (error) {
      console.error('sendSprintNotificationEmail error for recipient:', recipient.userId, error);
      results.push({ success: false, error: String(error) });
    }
  }
  return results;
}
