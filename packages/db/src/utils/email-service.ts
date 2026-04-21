import { db } from '../index';
import { emailTemplates, notificationPreferences } from '../schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';

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

/**
 * Built-in fallback templates used when no DB templates exist.
 * These ensure emails work out of the box without seeding.
 */
// ---------------------------------------------------------------------------
// Built-in email templates (email-safe HTML: tables, inline styles only).
// Shared fragments are composed into each template below.
// Font stack + palette follow the TaskNebula design system:
//   brand  #4f46e5 / #7c3aed (indigo → violet gradient)
//   body   #111827  muted #6b7280  border #e5e7eb  surface #ffffff
// ---------------------------------------------------------------------------

const EMAIL_FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

function renderShell(args: {
  kicker: string;
  heading: string;
  body: string; // inner HTML after heading (paragraphs, meta rows, etc.)
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const { kicker, heading, body, ctaLabel, ctaUrl } = args;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>TaskNebula</title></head>
<body style="margin:0;padding:0;background-color:#f5f6fa;font-family:${EMAIL_FONT};color:#111827;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f6fa;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="padding:0 4px 16px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="font-family:${EMAIL_FONT};color:#111827;font-weight:600;font-size:18px;letter-spacing:-0.01em;">TaskNebula</td>
<td align="right" width="120"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td height="2" width="96" style="height:2px;width:96px;line-height:2px;font-size:0;background-color:#4f46e5;background-image:linear-gradient(90deg,#4f46e5,#7c3aed);">&nbsp;</td></tr></table></td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:32px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">
<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT};color:#6b7280;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;">${kicker}</p>
<h1 style="margin:0 0 12px 0;font-family:${EMAIL_FONT};font-size:20px;font-weight:600;line-height:1.35;color:#111827;letter-spacing:-0.01em;">${heading}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px 0;"><tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:40px;v-text-anchor:middle;width:180px;" arcsize="10%" stroke="f" fillcolor="#4f46e5">
<w:anchorlock/>
<center style="color:#ffffff;font-family:${EMAIL_FONT};font-size:14px;font-weight:500;">${ctaLabel}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${ctaUrl}" style="background:#4f46e5;color:#ffffff;display:inline-block;font-family:${EMAIL_FONT};font-size:14px;font-weight:500;line-height:1;padding:12px 24px;text-decoration:none;border-radius:4px;mso-hide:all;">${ctaLabel}</a>
<!--<![endif]-->
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 4px 0 4px;font-family:${EMAIL_FONT};font-size:12px;color:#6b7280;" align="center">
<a href="{{unsubscribeUrl}}" style="color:#6b7280;text-decoration:none;">Manage notifications</a>
&nbsp;&middot;&nbsp;
<a href="{{appUrl}}" style="color:#6b7280;text-decoration:none;">Open TaskNebula</a>
&nbsp;&middot;&nbsp;
<a href="{{appUrl}}/help" style="color:#6b7280;text-decoration:none;">Help</a>
</td></tr>
<tr><td style="padding:8px 4px 0 4px;font-family:${EMAIL_FONT};font-size:11px;color:#9ca3af;" align="center">
You're receiving this because you're a member of {{organizationName}}.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// Two-column meta row (muted label on the left, value on the right).
function metaRow(label: string, value: string): string {
  return `<tr>
<td style="padding:6px 0;font-family:${EMAIL_FONT};font-size:13px;color:#6b7280;width:120px;vertical-align:top;">${label}</td>
<td style="padding:6px 0;font-family:${EMAIL_FONT};font-size:13px;color:#111827;vertical-align:top;">${value}</td>
</tr>`;
}

function metaTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 4px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">${rows}</table>`;
}

const BUILTIN_TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  issue_assigned: {
    subject: '[{{projectName}}] {{issueKey}} assigned to you — {{issueTitle}}',
    html: renderShell({
      kicker: 'ASSIGNMENT',
      heading: '{{issueTitle}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} assigned <strong style="color:#111827;">{{issueKey}}</strong> to you.</p>` +
        metaTable(metaRow('Issue', '<strong style="color:#111827;">{{issueKey}}</strong>') + metaRow('Project', '{{projectName}}')),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} assigned {{issueKey}} to you.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  issue_mentioned: {
    subject: '@mention: {{issueKey}} in {{projectName}}',
    html: renderShell({
      kicker: 'MENTION',
      heading: '{{actorName}} mentioned you',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">You were mentioned in <strong style="color:#111827;">{{issueKey}}</strong> &mdash; {{issueTitle}}.</p>` +
        metaTable(metaRow('Issue', '<strong style="color:#111827;">{{issueKey}}</strong>') + metaRow('Project', '{{projectName}}')),
      ctaLabel: 'Open thread',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} mentioned you in {{issueKey}}: {{issueTitle}}\n\n' +
      'Project: {{projectName}}\n\n' +
      'Open: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  issue_commented: {
    subject: '{{actorName}} commented on {{issueKey}}',
    html: renderShell({
      kicker: 'COMMENT',
      heading: '{{issueTitle}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} commented on <strong style="color:#111827;">{{issueKey}}</strong>.</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 4px 0;"><tr><td style="background:#f9fafb;border-left:3px solid #4f46e5;padding:12px 16px;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{commentBody}}</td></tr></table>` +
        metaTable(metaRow('Issue', '<strong style="color:#111827;">{{issueKey}}</strong>') + metaRow('Project', '{{projectName}}')),
      ctaLabel: 'Reply in thread',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} commented on {{issueKey}}: {{issueTitle}}\n\n' +
      '"{{commentBody}}"\n\n' +
      'Project: {{projectName}}\n\n' +
      'Reply: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  issue_status_changed: {
    subject: '[{{projectName}}] {{issueKey}} → {{newStatus}}',
    html: renderShell({
      kicker: 'STATUS CHANGE',
      heading: '{{issueTitle}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} moved <strong style="color:#111827;">{{issueKey}}</strong> to <span style="display:inline-block;background:#f3f4f6;color:#374151;border-radius:2px;font-size:11px;padding:2px 8px;font-weight:500;letter-spacing:0.02em;">{{newStatus}}</span>.</p>` +
        metaTable(
          metaRow('Issue', '<strong style="color:#111827;">{{issueKey}}</strong>') +
            metaRow('Project', '{{projectName}}') +
            metaRow('New status', '{{newStatus}}'),
        ),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} moved {{issueKey}} to {{newStatus}}.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  issue_created: {
    subject: '[{{projectName}}] New issue {{issueKey}} — {{issueTitle}}',
    html: renderShell({
      kicker: 'NEW ISSUE',
      heading: '{{issueTitle}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} created <strong style="color:#111827;">{{issueKey}}</strong> and assigned it to you.</p>` +
        metaTable(metaRow('Issue', '<strong style="color:#111827;">{{issueKey}}</strong>') + metaRow('Project', '{{projectName}}')),
      ctaLabel: 'View issue',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      '{{actorName}} created {{issueKey}} and assigned it to you.\n\n' +
      '{{issueTitle}}\n' +
      'Project: {{projectName}}\n\n' +
      'View: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  sprint_started: {
    subject: '[{{projectName}}] Sprint started — {{sprintName}}',
    html: renderShell({
      kicker: 'SPRINT STARTED',
      heading: '{{sprintName}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} started a new sprint in <strong style="color:#111827;">{{projectName}}</strong>.</p>` +
        `<p style="margin:12px 0 0 0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{sprintGoal}}</p>` +
        metaTable(
          metaRow('Sprint', '<strong style="color:#111827;">{{sprintName}}</strong>') +
            metaRow('Project', '{{projectName}}') +
            metaRow('Dates', '{{sprintStartDate}} &rarr; {{sprintEndDate}}') +
            metaRow('Issues', '{{issueCount}}'),
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
      'Open: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  sprint_completed: {
    subject: '[{{projectName}}] Sprint completed — {{sprintName}}',
    html: renderShell({
      kicker: 'SPRINT COMPLETED',
      heading: '{{sprintName}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">{{actorName}} closed the sprint in <strong style="color:#111827;">{{projectName}}</strong>. Here's the recap.</p>` +
        metaTable(
          metaRow('Sprint', '<strong style="color:#111827;">{{sprintName}}</strong>') +
            metaRow('Project', '{{projectName}}') +
            metaRow('Dates', '{{sprintStartDate}} &rarr; {{sprintEndDate}}') +
            metaRow('Issues', '{{issueCount}}'),
        ),
      ctaLabel: 'View retrospective',
      ctaUrl: '{{issueUrl}}',
    }),
    text:
      'Sprint completed: {{sprintName}}\n\n' +
      'Dates: {{sprintStartDate}} -> {{sprintEndDate}}\n' +
      'Issues: {{issueCount}}\n' +
      'Project: {{projectName}}\n\n' +
      'Retrospective: {{issueUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  daily_digest: {
    subject: 'Your daily digest — {{period}}',
    html: renderShell({
      kicker: 'DAILY DIGEST',
      heading: "Here's what happened today",
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">A quick recap of activity across <strong style="color:#111827;">{{organizationName}}</strong> for {{period}}.</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 4px 0;"><tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;font-family:${EMAIL_FONT};font-size:13px;line-height:1.7;color:#374151;">{{activityList}}</td></tr></table>` +
        `<p style="margin:12px 0 0 0;font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:#6b7280;">{{issuesSummary}}</p>`,
      ctaLabel: 'Open TaskNebula',
      ctaUrl: '{{appUrl}}',
    }),
    text:
      'Daily digest — {{period}}\n\n' +
      '{{activityList}}\n\n' +
      '{{issuesSummary}}\n\n' +
      'Open: {{appUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },

  weekly_digest: {
    subject: 'Your weekly digest — {{period}}',
    html: renderShell({
      kicker: 'WEEKLY DIGEST',
      heading: 'This week in {{organizationName}}',
      body:
        `<p style="margin:0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#374151;">A summary of activity for {{period}}.</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 4px 0;"><tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;font-family:${EMAIL_FONT};font-size:13px;line-height:1.7;color:#374151;">{{activityList}}</td></tr></table>` +
        `<p style="margin:12px 0 0 0;font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:#6b7280;">{{issuesSummary}}</p>`,
      ctaLabel: 'Open TaskNebula',
      ctaUrl: '{{appUrl}}',
    }),
    text:
      'Weekly digest — {{period}}\n\n' +
      '{{activityList}}\n\n' +
      '{{issuesSummary}}\n\n' +
      'Open: {{appUrl}}\n\n' +
      '---\n' +
      'Manage notifications: {{unsubscribeUrl}}\n' +
      "You're receiving this because you're a member of {{organizationName}}.",
  },
};

/**
 * Replace template variables with actual values
 *
 * Example:
 * replaceVariables("Hello {{userName}}", { userName: "John" }) => "Hello John"
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
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

    // Quiet-by-default policy: critical events (assigned, mentioned) are on;
    // everything else is off until the user opts in.
    const DEFAULT_EVENT_POLICY: Record<string, boolean> = {
      issue_assigned: true,
      issue_mentioned: true,
      issue_commented: false,
      issue_status_changed: false,
      issue_created: false,
      sprint_started: false,
      sprint_completed: false,
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
  try {
    // Try organization-specific template first
    const [orgTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.organizationId, organizationId),
          eq(emailTemplates.type, templateType as any),
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
          eq(emailTemplates.type, templateType as any),
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
  eventType: 'issue_assigned' | 'issue_mentioned' | 'issue_commented' | 'issue_status_changed' | 'issue_created';
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

