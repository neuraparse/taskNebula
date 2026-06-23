'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { IntakeFieldDefinition, IntakeFieldType } from '@tasknebula/db';

interface RecentSubmission {
  id: string;
  submittedByEmail: string | null;
  status: string;
  createdIssueId: string | null;
  createdAt: string;
}

interface Props {
  form: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    fields: IntakeFieldDefinition[];
    isPublic: boolean;
    requiresCaptcha: boolean;
    targetStatus: string;
  };
  recentSubmissions: RecentSubmission[];
}

const FIELD_TYPES: IntakeFieldType[] = ['text', 'textarea', 'email', 'select', 'file'];

/**
 * Minimal form builder for v1. No drag-and-drop — fields are reordered
 * via up/down buttons. Save sends a single PATCH with the whole field
 * array, which keeps server-side validation simple and matches the way
 * Drafts / templates handle JSON-driven content.
 */
export function IntakeFormEditor({ form, recentSubmissions }: Props) {
  const router = useRouter();
  const t = useTranslations('planning');
  const formatter = useFormatter();
  const [title, setTitle] = useState(form.title);
  const [slug, setSlug] = useState(form.slug);
  const [description, setDescription] = useState(form.description ?? '');
  const [isPublic, setIsPublic] = useState(form.isPublic);
  const [requiresCaptcha, setRequiresCaptcha] = useState(form.requiresCaptcha);
  const [targetStatus, setTargetStatus] = useState(form.targetStatus);
  const [fields, setFields] = useState<IntakeFieldDefinition[]>(form.fields);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateField = (index: number, patch: Partial<IntakeFieldDefinition>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        name: `field_${prev.length + 1}`,
        label: t('field_default_label', { index: prev.length + 1 }),
        type: 'text',
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((prev) => {
      const next = prev.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      if (!item) return prev;
      next.splice(target, 0, item);
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/intake-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          description: description || null,
          isPublic,
          requiresCaptcha,
          targetStatus,
          fields,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t('error_save'));
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/settings/intake-forms"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t('all_intake_forms')}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t('edit_intake_form')}</h1>
          {savedAt ? (
            <span className="text-muted-foreground text-xs">
              {t('saved_at', {
                time: formatter.dateTime(savedAt, { timeStyle: 'short' }),
              })}
            </span>
          ) : null}
        </div>
      </header>

      <section className="border-border bg-card space-y-4 rounded-md border p-5">
        <h2 className="text-foreground text-sm font-medium">{t('section_details')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">{t('label_title')}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">{t('label_slug')}</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
            <p className="text-muted-foreground text-xs">
              {t('public_url_label')} {'/intake/'}
              {slug || form.slug}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t('label_description')}</Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-border flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isPublic" className="text-sm">
                {t('toggle_public')}
              </Label>
              <p className="text-muted-foreground text-xs">{t('toggle_public_hint')}</p>
            </div>
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="border-border flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="requiresCaptcha" className="text-sm">
                {t('toggle_captcha')}
              </Label>
              <p className="text-muted-foreground text-xs">{t('toggle_captcha_hint')}</p>
            </div>
            <Switch
              id="requiresCaptcha"
              checked={requiresCaptcha}
              onCheckedChange={setRequiresCaptcha}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('label_target_status')}</Label>
            <Select value={targetStatus} onValueChange={setTargetStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="triage">{t('target_status_triage')}</SelectItem>
                <SelectItem value="backlog">{t('target_status_backlog')}</SelectItem>
                <SelectItem value="in_progress">{t('target_status_in_progress')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="border-border bg-card space-y-4 rounded-md border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-sm font-medium">{t('section_fields')}</h2>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1.5 h-4 w-4" /> {t('add_field')}
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('no_fields')}</p>
        ) : (
          <ul className="space-y-3">
            {fields.map((field, index) => (
              <li key={index} className="border-border space-y-3 rounded-md border p-4">
                <div className="flex items-start justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('field_label_name')}</Label>
                      <Input
                        value={field.name}
                        onChange={(e) =>
                          updateField(index, {
                            name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('field_label_label')}</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('field_label_type')}</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(index, { type: v as IntakeFieldType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => (
                            <SelectItem key={ft} value={ft}>
                              {t(`field_type_${ft}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        id={`required-${index}`}
                        checked={Boolean(field.required)}
                        onCheckedChange={(v) => updateField(index, { required: v })}
                      />
                      <Label htmlFor={`required-${index}`} className="text-sm">
                        {t('field_required')}
                      </Label>
                    </div>
                    {field.type === 'select' ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">{t('field_options')}</Label>
                        <Textarea
                          rows={3}
                          value={(field.options ?? []).join('\n')}
                          onChange={(e) =>
                            updateField(index, {
                              options: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-3 flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      aria-label={t('move_up')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      aria-label={t('move_down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(index)}
                      aria-label={t('remove_field')}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-border bg-card space-y-3 rounded-md border p-5">
        <h2 className="text-foreground text-sm font-medium">{t('section_recent_submissions')}</h2>
        {recentSubmissions.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('no_submissions')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentSubmissions.map((s) => (
              <li
                key={s.id}
                className="border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <span className="text-foreground">{s.submittedByEmail ?? t('anonymous')}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {formatter.dateTime(new Date(s.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex items-center justify-end gap-2">
        {error ? <span className="text-destructive text-xs">{error}</span> : null}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save_changes')}
        </Button>
      </footer>
    </div>
  );
}
