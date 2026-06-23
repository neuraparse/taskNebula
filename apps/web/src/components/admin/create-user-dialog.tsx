'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';

export function CreateUserDialog() {
  const t = useTranslations('adminDialogs');
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isSuperAdmin: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('createUser.toastFailedTitle'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('createUser.toastCreatedTitle'),
        description: t('createUser.toastCreatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setOpen(false);
      setFormData({ name: '', email: '', password: '', isSuperAdmin: false });
    },
    onError: () => {
      toast({
        title: t('createUser.toastFailedTitle'),
        description: t('createUser.toastFailedTitle'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: t('common.missingFields'),
        description: t('createUser.missingFieldsDescription'),
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('createUser.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('createUser.title')}</DialogTitle>
            <DialogDescription>{t('createUser.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('createUser.fullName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('createUser.fullNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('createUser.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('createUser.emailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('createUser.password')}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="border-border flex items-center justify-between rounded-md border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="super-admin">{t('userForm.superAdmin')}</Label>
                <p className="text-muted-foreground text-xs">{t('userForm.superAdminHint')}</p>
              </div>
              <Switch
                id="super-admin"
                checked={formData.isSuperAdmin}
                onCheckedChange={(checked) => setFormData({ ...formData, isSuperAdmin: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createUser.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
