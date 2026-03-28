'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/lib/hooks/use-projects';
import { Plus, X } from 'lucide-react';

interface ProjectItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  organizationName: string;
}

export function ProjectsClient({ projects }: { projects: ProjectItem[] }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} active project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">No Projects Yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first project to get started
            </p>
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.key.toLowerCase()}`}
                className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold group-hover:text-primary">
                        {project.key}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-medium">{project.name}</p>
                    {project.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.organizationName}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showDialog && (
        <CreateProjectDialog onClose={() => setShowDialog(false)} />
      )}
    </div>
  );
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const createProject = useCreateProject();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [keyManual, setKeyManual] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!keyManual) {
      const autoKey = value
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 6);
      setKey(autoKey);
    }
  };

  const handleKeyChange = (value: string) => {
    setKeyManual(true);
    setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || undefined,
      });
      onClose();
      router.refresh();
    } catch {
      // error handled by mutation state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-lg border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Create Project</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project Name
            </label>
            <Input
              id="project-name"
              placeholder="My Awesome Project"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project-key" className="text-sm font-medium">
              Project Key
            </label>
            <Input
              id="project-key"
              placeholder="MAP"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              required
              maxLength={10}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Used as issue prefix (e.g. {key || 'KEY'}-1, {key || 'KEY'}-2)
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-desc" className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="project-desc"
              placeholder="Brief project description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {createProject.error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {createProject.error.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending || !name.trim() || !key.trim()}>
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
