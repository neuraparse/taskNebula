'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';

interface FormSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  projectId: string;
  updatedAt: Date | string;
}

interface ProjectSummary {
  id: string;
  name: string;
  key: string;
}

interface Props {
  forms: FormSummary[];
  projectLookup: Record<string, ProjectSummary>;
  accessibleProjects: ProjectSummary[];
}

export function IntakeFormsList({ forms, projectLookup, accessibleProjects }: Props) {
  const router = useRouter();
  const t = useTranslations('planning');
  const tActions = useTranslations('actions');
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(accessibleProjects[0]?.id ?? '');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!projectId || !slug || !title) {
      setError(t('error_project_slug_title_required'));
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/intake-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          slug,
          title,
          fields: [
            { name: 'summary', label: t('field_summary'), type: 'text', required: true },
            { name: 'details', label: t('field_details'), type: 'textarea' },
            { name: 'email', label: t('field_your_email'), type: 'email' },
          ],
        }),
      });
      const data = (await response.json()) as { error?: string; form?: { id: string } };
      if (!response.ok || !data.form) {
        setError(t('error_create_form'));
        return;
      }
      setOpen(false);
      router.push(`/settings/intake-forms/${data.form.id}/edit`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm(t('delete_form_confirm'));
    if (!ok) return;
    const response = await fetch(`/api/intake-forms/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('form_count', { count: forms.length })}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={accessibleProjects.length === 0}>
              <Plus className="mr-1.5 h-4 w-4" /> {t('new_form')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('create_intake_form')}</DialogTitle>
              <DialogDescription>{t('create_intake_form_desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('label_project')}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_project')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {'('}
                        {p.key}
                        {')'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">{t('label_title')}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('title_placeholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">{t('label_slug')}</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                  }
                  placeholder={t('slug_placeholder')}
                />
                <p className="text-muted-foreground text-xs">
                  {t('public_url_label')} {'/intake/'}
                  <code>{slug || t('slug_fallback')}</code>
                </p>
              </div>
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tActions('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? t('creating') : t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {forms.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {t.rich('empty_forms', {
            action: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {forms.map((form) => {
            const project = projectLookup[form.projectId];
            return (
              <li
                key={form.id}
                className="border-border bg-card flex items-center justify-between rounded-md border p-4"
              >
                <div className="space-y-0.5">
                  <Link
                    href={`/settings/intake-forms/${form.id}/edit`}
                    className="text-foreground font-medium hover:underline"
                  >
                    {form.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {project ? `${project.name} (${project.key}) · ` : ''}
                    {'/intake/'}
                    {form.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/intake/${form.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(form.id)}
                    aria-label={t('delete_form_aria')}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
