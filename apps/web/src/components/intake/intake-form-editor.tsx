'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
        label: `Field ${prev.length + 1}`,
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
        setError(data.error ?? 'Failed to save');
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
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All intake forms
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Edit intake form</h1>
          {savedAt ? (
            <span className="text-xs text-muted-foreground">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      </header>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
            <p className="text-xs text-muted-foreground">
              Public URL: /intake/{slug || form.slug}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="isPublic" className="text-sm">
                Public
              </Label>
              <p className="text-xs text-muted-foreground">Anyone can submit</p>
            </div>
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="requiresCaptcha" className="text-sm">
                Require captcha
              </Label>
              <p className="text-xs text-muted-foreground">When provider configured</p>
            </div>
            <Switch
              id="requiresCaptcha"
              checked={requiresCaptcha}
              onCheckedChange={setRequiresCaptcha}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target status</Label>
            <Select value={targetStatus} onValueChange={setTargetStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="triage">Triage (backlog)</SelectItem>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Fields</h2>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1.5 h-4 w-4" /> Add field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No fields yet. Add one to get started.</p>
        ) : (
          <ul className="space-y-3">
            {fields.map((field, index) => (
              <li key={index} className="rounded-md border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
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
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          updateField(index, { type: v as IntakeFieldType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
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
                        Required
                      </Label>
                    </div>
                    {field.type === 'select' ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Options (one per line)</Label>
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
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(index)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">Recent submissions</h2>
        {recentSubmissions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentSubmissions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <span className="text-foreground">{s.submittedByEmail ?? 'Anonymous'}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex items-center justify-end gap-2">
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </footer>
    </div>
  );
}
