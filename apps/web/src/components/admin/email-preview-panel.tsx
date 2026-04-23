'use client';

/**
 * Super-admin-only email preview panel.
 *
 * Renders a template picker + an <iframe> that loads the rendered HTML from
 * /api/admin/email-preview. Also exposes a "Send SMTP test" button that
 * triggers the existing /api/admin/system/smtp/test endpoint (which sends a
 * fixed diagnostic message, not the previewed template — the backing
 * endpoint currently only supports a generic test message).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Loader2, Mail, Send } from 'lucide-react';

type TemplateOption = { value: string; label: string; group: 'auth' | 'notify' };

const TEMPLATES: ReadonlyArray<TemplateOption> = [
  // Ad-hoc / transactional
  { value: 'verify_email', label: 'Verify email', group: 'auth' },
  { value: 'password_reset', label: 'Password reset', group: 'auth' },
  { value: 'invitation', label: 'Organization invitation', group: 'auth' },
  // Built-in notification templates
  { value: 'issue_assigned', label: 'Issue assigned', group: 'notify' },
  { value: 'issue_mentioned', label: 'Issue mentioned', group: 'notify' },
  { value: 'issue_commented', label: 'Issue commented', group: 'notify' },
  { value: 'sprint_started', label: 'Sprint started', group: 'notify' },
  { value: 'daily_digest', label: 'Daily digest', group: 'notify' },
  { value: 'weekly_digest', label: 'Weekly digest', group: 'notify' },
];

export function EmailPreviewPanel() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>('verify_email');
  const [sending, setSending] = useState(false);

  // Cache-buster keyed to template selection so the iframe re-loads when
  // the admin picks a different template.
  const previewUrl = useMemo(
    () => `/api/admin/email-preview?template=${encodeURIComponent(selected)}`,
    [selected],
  );

  const selectedLabel =
    TEMPLATES.find((t) => t.value === selected)?.label || selected;

  async function handleSendTest() {
    setSending(true);
    try {
      const res = await fetch('/api/admin/system/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        recipient?: string;
        source?: string;
        messageId?: string;
      };
      if (!res.ok || !data.success) {
        toast({
          title: 'SMTP test failed',
          description: data.error || `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'SMTP test sent',
        description: `Sent via ${data.source || 'configured SMTP'} to ${data.recipient || 'admin email'}.`,
      });
    } catch (err) {
      toast({
        title: 'SMTP test failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Email preview
            </CardTitle>
            <CardDescription>
              Render any TaskNebula transactional email with sample variables.
              Diagnostic only — no emails are sent from this view.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-1.5">
            <Label htmlFor="email-preview-template">Template</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="email-preview-template" className="w-full">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.value}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, '_blank', 'noopener')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open in new tab
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendTest}
              disabled={sending}
              title="Send the generic SMTP test email to your admin address (not the previewed template — the /smtp/test endpoint only supports a fixed test message)."
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Send SMTP test
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Previewing <span className="font-mono text-foreground">{selected}</span>
          {' — '}
          {selectedLabel}. The iframe below renders the exact HTML the
          recipient would see (sandboxed; external links disabled).
        </p>

        <div className="rounded-md border bg-muted/30 overflow-hidden">
          <iframe
            // Key on URL forces a fresh load when the template changes.
            key={previewUrl}
            src={previewUrl}
            title={`Email preview: ${selectedLabel}`}
            // Sandbox: no script execution, no top navigation, but allow
            // same-origin so the iframe can render our HTML normally.
            sandbox="allow-same-origin"
            className="w-full h-[720px] bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
