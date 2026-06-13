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
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>('verify_email');
  const [sending, setSending] = useState(false);

  // Cache-buster keyed to template selection so the iframe re-loads when
  // the admin picks a different template.
  const previewUrl = useMemo(
    () => `/api/admin/email-preview?template=${encodeURIComponent(selected)}`,
    [selected]
  );

  const templateLabel = (value: string) => t(`emailPreview.templates.${value}`);

  const selectedLabel = TEMPLATES.some((tpl) => tpl.value === selected)
    ? templateLabel(selected)
    : selected;

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
          title: t('emailPreview.smtpTestFailed'),
          description: data.error || `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: t('emailPreview.smtpTestSent'),
        description: t('emailPreview.smtpTestSentDescription', {
          source: data.source || t('emailPreview.configuredSmtp'),
          recipient: data.recipient || t('emailPreview.adminEmail'),
        }),
      });
    } catch (err) {
      toast({
        title: t('emailPreview.smtpTestFailed'),
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
              {t('emailPreview.title')}
            </CardTitle>
            <CardDescription>{t('emailPreview.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="email-preview-template">{t('emailPreview.template')}</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="email-preview-template" className="w-full">
                <SelectValue placeholder={t('emailPreview.pickTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.value} value={tpl.value}>
                    {templateLabel(tpl.value)}
                    <span className="text-muted-foreground ml-2 text-xs">{tpl.value}</span>
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
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {t('emailPreview.openInNewTab')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendTest}
              disabled={sending}
              title={t('emailPreview.sendSmtpTestTitle')}
            >
              {sending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('emailPreview.sendSmtpTest')}
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          {t('emailPreview.previewing')}{' '}
          <span className="text-foreground font-mono">{selected}</span>
          {' — '}
          {t('emailPreview.previewingDetail', { label: selectedLabel })}
        </p>

        <div className="bg-muted/30 overflow-hidden rounded-md border">
          <iframe
            // Key on URL forces a fresh load when the template changes.
            key={previewUrl}
            src={previewUrl}
            title={t('emailPreview.iframeTitle', { label: selectedLabel })}
            // Sandbox: no script execution, no top navigation, but allow
            // same-origin so the iframe can render our HTML normally.
            sandbox="allow-same-origin"
            className="h-[720px] w-full bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
