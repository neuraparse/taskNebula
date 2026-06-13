'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateOrganizationAdminDialog() {
  const t = useTranslations('adminDialogs');
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    ownerId: '',
    plan: 'free' as 'free' | 'starter' | 'growth' | 'enterprise',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usersData } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: open,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('createOrg.toastFailedTitle'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('createOrg.toastCreatedTitle'),
        description: t('createOrg.toastCreatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setOpen(false);
      setFormData({ name: '', slug: '', ownerId: '', plan: 'free' });
    },
    onError: (error: Error) => {
      toast({
        title: t('createOrg.toastFailedTitle'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug || !formData.ownerId) {
      toast({
        title: t('common.missingFields'),
        description: t('createOrg.missingFieldsDescription'),
        variant: 'destructive',
      });
      return;
    }
    createOrgMutation.mutate(formData);
  };

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('createOrg.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('createOrg.title')}</DialogTitle>
            <DialogDescription>{t('createOrg.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('orgForm.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: formData.slug || generateSlug(name),
                  });
                }}
                placeholder="Acme Inc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('orgForm.slug')}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="acme-inc"
              />
              <p className="text-muted-foreground text-xs">{t('orgForm.slugHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">{t('createOrg.owner')}</Label>
              <Select
                value={formData.ownerId}
                onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('createOrg.ownerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.users?.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">{t('orgForm.plan')}</Label>
              <Select
                value={formData.plan}
                onValueChange={(value: any) => setFormData({ ...formData, plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{t('orgForm.planFree')}</SelectItem>
                  <SelectItem value="starter">{t('orgForm.planStarter')}</SelectItem>
                  <SelectItem value="growth">{t('orgForm.planGrowth')}</SelectItem>
                  <SelectItem value="enterprise">{t('orgForm.planEnterprise')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createOrgMutation.isPending}>
              {createOrgMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createOrg.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
