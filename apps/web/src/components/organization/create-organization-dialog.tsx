'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateOrganizationDialogProps {
  /** Optional custom trigger element. Defaults to a "New Organization" button. */
  trigger?: React.ReactNode;
}

export function CreateOrganizationDialog({ trigger }: CreateOrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useTranslations('projectsPages');

  const handleNameChange = (value: string) => {
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSlug(generatedSlug);
  };

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('org_create_error_title'));
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('org_created_title'),
        description: t('org_created_description', { name: data.name }),
      });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setOpen(false);
      setName('');
      setSlug('');
      router.refresh();
    },
    onError: () => {
      toast({
        title: t('org_create_error_title'),
        description: t('org_create_error_title'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    createOrgMutation.mutate({ name, slug });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('org_new_button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-md">
              <Building2 className="text-primary h-4 w-4" />
            </div>
            <div>
              <DialogTitle>{t('org_create_title')}</DialogTitle>
              <DialogDescription>{t('org_create_subtitle')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t('org_name_label')}</Label>
            <Input
              id="org-name"
              placeholder={t('org_name_placeholder')}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">{t('org_slug_label')}</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0 text-sm">{'tasknebula.io/'}</span>
              <Input
                id="org-slug"
                placeholder={t('org_slug_placeholder')}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-z0-9-]+"
                required
              />
            </div>
            <p className="text-muted-foreground text-xs">{t('org_slug_helper')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={createOrgMutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name || !slug || createOrgMutation.isPending}
            >
              {createOrgMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
