'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown, AlertTriangle } from 'lucide-react';

type EditUserDialogProps = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditUserDialog({ userId, open, onOpenChange }: EditUserDialogProps) {
  const t = useTranslations('adminDialogs');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    status: 'active' as 'active' | 'inactive' | 'invited',
    isSuperAdmin: false,
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!userId && open,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        status: user.status || 'active',
        isSuperAdmin: user.isSuperAdmin || false,
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('editUser.toastFailedTitle'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({
        title: t('editUser.toastUpdatedTitle'),
        description: t('editUser.toastUpdatedDescription'),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('editUser.toastFailedTitle'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editUser.title')}</DialogTitle>
          <DialogDescription>{t('editUser.description')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* User info */}
            <div className="border-border bg-surface flex items-center gap-3 rounded-md border px-4 py-3">
              <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{user?.name || user?.email}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t('editUser.status')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('editUser.statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('editUser.statusInactive')}</SelectItem>
                  <SelectItem value="invited">{t('editUser.statusInvited')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-border flex items-center justify-between rounded-md border px-4 py-3">
              <div className="flex items-center gap-2">
                <Crown className="text-accent-amber h-4 w-4" />
                <div className="space-y-0.5">
                  <Label htmlFor="super-admin" className="font-medium">
                    {t('userForm.superAdmin')}
                  </Label>
                  <p className="text-muted-foreground text-xs">{t('userForm.superAdminHint')}</p>
                </div>
              </div>
              <Switch
                id="super-admin"
                checked={formData.isSuperAdmin}
                onCheckedChange={(checked) => setFormData({ ...formData, isSuperAdmin: checked })}
              />
            </div>

            {formData.isSuperAdmin && (
              <div className="panel-warn flex items-start gap-2 px-3 py-3 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('editUser.superAdminWarning')}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
