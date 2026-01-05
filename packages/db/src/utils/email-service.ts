import { db } from '../index';
import { emailTemplates, notificationPreferences } from '../schema';
import { eq, and } from 'drizzle-orm';

/**
 * Email Service
 * 
 * Handles email sending with template rendering and user preferences.
 * Uses Resend for email delivery (can be swapped with Nodemailer).
 * 
 * Features:
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

/**
 * Send email using template
 *
 * This is a placeholder implementation.
 * In production, integrate with Resend, SendGrid, or Nodemailer.
 */
export async function sendEmail(params: EmailParams): Promise<SendEmailResult> {
  try {
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

    // Get template
    const template = await getTemplate(params.organizationId, params.templateType);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, params.variables);
    const htmlBody = replaceVariables(template.htmlBody, params.variables);
    const textBody = replaceVariables(template.textBody, params.variables);

    // TODO: Integrate with actual email service (Resend, SendGrid, etc.)
    // For now, just log the email
    console.log('📧 Email would be sent:', {
      to: params.to,
      subject,
      preview: textBody.substring(0, 100),
    });

    // Placeholder: Return success
    return { success: true, messageId: `mock-${Date.now()}` };
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

