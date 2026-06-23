'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { useCreateFeatureFlag } from '@/lib/hooks/use-feature-flags';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { OrganizationMultiSelect } from '@/components/admin/organization-multi-select';

const PLANS = ['free', 'starter', 'growth', 'enterprise'] as const;

export function CreateFeatureFlagDialog() {
  const t = useTranslations('adminDialogs');
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [enabledForPlans, setEnabledForPlans] = useState<string[]>([]);
  const [enabledForOrganizations, setEnabledForOrganizations] = useState<string[]>([]);
  const [rolloutPercentage, setRolloutPercentage] = useState(0);

  const { toast } = useToast();
  const createFeatureFlag = useCreateFeatureFlag();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFeatureFlag.mutateAsync({
        key,
        name,
        description: description || undefined,
        isEnabled,
        enabledForPlans,
        enabledForOrganizations,
        rolloutPercentage,
      });
      toast({
        title: t('createFlag.toastCreatedTitle'),
        description: t('createFlag.toastCreatedDescription', { name }),
      });
      setKey('');
      setName('');
      setDescription('');
      setIsEnabled(false);
      setEnabledForPlans([]);
      setEnabledForOrganizations([]);
      setRolloutPercentage(0);
      setOpen(false);
    } catch {
      toast({
        title: t('createFlag.toastFailedTitle'),
        description: t('common.somethingWentWrong'),
        variant: 'destructive',
      });
    }
  };

  const togglePlan = (plan: string) => {
    setEnabledForPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('createFlag.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('createFlag.title')}</DialogTitle>
            <DialogDescription>{t('createFlag.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">{t('flagForm.key')}</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t('flagForm.keyPlaceholder')}
                pattern="[a-z0-9_-]+"
                required
              />
              <p className="text-muted-foreground text-xs">{t('flagForm.keyHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('flagForm.name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('flagForm.namePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('flagForm.descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('flagForm.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">{t('flagForm.enabled')}</Label>
                <p className="text-muted-foreground text-xs">{t('createFlag.enabledHint')}</p>
              </div>
              <Switch id="enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            <div className="space-y-2">
              <Label>{t('flagForm.plans')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((plan) => (
                  <label
                    key={plan}
                    className="flex cursor-pointer items-center gap-2 text-sm capitalize"
                  >
                    <Checkbox
                      id={`plan-${plan}`}
                      checked={enabledForPlans.includes(plan)}
                      onCheckedChange={() => togglePlan(plan)}
                    />
                    {plan}
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">{t('flagForm.plansHint')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('flagForm.targetOrganizations')}</Label>
              <OrganizationMultiSelect
                value={enabledForOrganizations}
                onChange={setEnabledForOrganizations}
              />
              <p className="text-muted-foreground text-xs">
                {t('flagForm.targetOrganizationsHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rollout">
                {t('flagForm.rollout', { percentage: rolloutPercentage })}
              </Label>
              <input
                type="range"
                id="rollout"
                min="0"
                max="100"
                step="5"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                className="accent-primary w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createFeatureFlag.isPending}>
              {createFeatureFlag.isPending ? t('createFlag.submitting') : t('createFlag.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
