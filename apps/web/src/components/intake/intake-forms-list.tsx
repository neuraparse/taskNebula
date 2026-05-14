'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(accessibleProjects[0]?.id ?? '');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!projectId || !slug || !title) {
      setError('Project, slug and title are required');
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
            { name: 'summary', label: 'Summary', type: 'text', required: true },
            { name: 'details', label: 'Details', type: 'textarea' },
            { name: 'email', label: 'Your email', type: 'email' },
          ],
        }),
      });
      const data = (await response.json()) as { error?: string; form?: { id: string } };
      if (!response.ok || !data.form) {
        setError(data.error ?? 'Failed to create form');
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
    const ok = window.confirm('Delete this intake form? Submissions will be removed.');
    if (!ok) return;
    const response = await fetch(`/api/intake-forms/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {forms.length} {forms.length === 1 ? 'form' : 'forms'}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={accessibleProjects.length === 0}>
              <Plus className="mr-1.5 h-4 w-4" /> New form
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create intake form</DialogTitle>
              <DialogDescription>
                Pick a project and choose a public slug. You can edit fields next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Customer feedback"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="customer-feedback"
                />
                <p className="text-xs text-muted-foreground">
                  Public URL: /intake/<code>{slug || 'your-slug'}</code>
                </p>
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {forms.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No intake forms yet. Click <span className="font-medium">New form</span> to create one.
        </div>
      ) : (
        <ul className="space-y-2">
          {forms.map((form) => {
            const project = projectLookup[form.projectId];
            return (
              <li
                key={form.id}
                className="flex items-center justify-between rounded-md border border-border bg-card p-4"
              >
                <div className="space-y-0.5">
                  <Link
                    href={`/settings/intake-forms/${form.id}/edit`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {form.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {project ? `${project.name} (${project.key}) · ` : ''}
                    /intake/{form.slug}
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
                    aria-label="Delete form"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
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
