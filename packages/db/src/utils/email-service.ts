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
const BUILTIN_TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  issue_assigned: {
    subject: '[{{projectName}}] {{issueKey}} assigned to you — {{issueTitle}}',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<p><strong>{{actorName}}</strong> assigned <strong>{{issueKey}}</strong> to you.</p>
<h3 style="margin:8px 0">{{issueTitle}}</h3>
<p>Project: {{projectName}}</p>
<p><a href="{{issueUrl}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View Issue</a></p>
<p style="color:#888;font-size:12px"><a href="{{unsubscribeUrl}}">Notification settings</a></p></div>`,
    text: '{{actorName}} assigned {{issueKey}} to you: {{issueTitle}}\n\nProject: {{projectName}}\nView: {{issueUrl}}',
  },
  issue_status_changed: {
    subject: '[{{projectName}}] {{issueKey}} status changed — {{issueTitle}}',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<p><strong>{{actorName}}</strong> changed the status of <strong>{{issueKey}}</strong>.</p>
<h3 style="margin:8px 0">{{issueTitle}}</h3>
<p>New status: <strong>{{newStatus}}</strong></p>
<p>Project: {{projectName}}</p>
<p><a href="{{issueUrl}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View Issue</a></p>
<p style="color:#888;font-size:12px"><a href="{{unsubscribeUrl}}">Notification settings</a></p></div>`,
    text: '{{actorName}} changed status of {{issueKey}}: {{issueTitle}}\nNew status: {{newStatus}}\n\nProject: {{projectName}}\nView: {{issueUrl}}',
  },
  issue_commented: {
    subject: '[{{projectName}}] New comment on {{issueKey}} — {{issueTitle}}',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<p><strong>{{actorName}}</strong> commented on <strong>{{issueKey}}</strong>.</p>
<h3 style="margin:8px 0">{{issueTitle}}</h3>
<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555;margin:12px 0">{{commentBody}}</blockquote>
<p>Project: {{projectName}}</p>
<p><a href="{{issueUrl}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View Comment</a></p>
<p style="color:#888;font-size:12px"><a href="{{unsubscribeUrl}}">Notification settings</a></p></div>`,
    text: '{{actorName}} commented on {{issueKey}}: {{issueTitle}}\n\n"{{commentBody}}"\n\nProject: {{projectName}}\nView: {{issueUrl}}',
  },
  issue_created: {
    subject: '[{{projectName}}] New issue {{issueKey}} — {{issueTitle}}',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<p><strong>{{actorName}}</strong> created <strong>{{issueKey}}</strong> and assigned it to you.</p>
<h3 style="margin:8px 0">{{issueTitle}}</h3>
<p>Project: {{projectName}}</p>
<p><a href="{{issueUrl}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View Issue</a></p>
<p style="color:#888;font-size:12px"><a href="{{unsubscribeUrl}}">Notification settings</a></p></div>`,
    text: '{{actorName}} created {{issueKey}} and assigned it to you: {{issueTitle}}\n\nProject: {{projectName}}\nView: {{issueUrl}}',
  },
  issue_mentioned: {
    subject: '[{{projectName}}] You were mentioned in {{issueKey}} — {{issueTitle}}',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<p><strong>{{actorName}}</strong> mentioned you in <strong>{{issueKey}}</strong>.</p>
<h3 style="margin:8px 0">{{issueTitle}}</h3>
<p>Project: {{projectName}}</p>
<p><a href="{{issueUrl}}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View Issue</a></p>
<p style="color:#888;font-size:12px"><a href="{{unsubscribeUrl}}">Notification settings</a></p></div>`,
    text: '{{actorName}} mentioned you in {{issueKey}}: {{issueTitle}}\n\nProject: {{projectName}}\nView: {{issueUrl}}',
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

    // If no preferences found, use defaults (send email)
    if (!prefs) return true;

    // Check if email notifications are enabled
    if (!prefs.enableEmail) return false;

    // Check do not disturb mode
    if (prefs.doNotDisturb && prefs.doNotDisturbStart && prefs.doNotDisturbEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Simple time range check (doesn't handle overnight ranges perfectly)
      if (currentTime >= prefs.doNotDisturbStart && currentTime <= prefs.doNotDisturbEnd) {
        return false;
      }
    }

    // Check event-specific preferences
    const eventPreferenceMap: Record<string, boolean> = {
      issue_assigned: prefs.emailOnAssigned,
      issue_mentioned: prefs.emailOnMentioned,
      issue_commented: prefs.emailOnCommented,
      issue_status_changed: prefs.emailOnStatusChanged,
      issue_created: prefs.emailOnIssueCreated,
      sprint_started: prefs.emailOnSprintStarted,
      sprint_completed: prefs.emailOnSprintCompleted,
    };

    return eventPreferenceMap[eventType] ?? true;
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

