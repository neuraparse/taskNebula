'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUpdateFeatureFlag } from '@/lib/hooks/use-feature-flags';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { OrganizationMultiSelect } from '@/components/admin/organization-multi-select';

const PLANS = ['free', 'starter', 'growth', 'enterprise'] as const;

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForOrganizations: string[];
  rolloutPercentage: number;
  metadata: Record<string, unknown>;
}

interface EditFeatureFlagDialogProps {
  flag: FeatureFlag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFeatureFlagDialog({ flag, open, onOpenChange }: EditFeatureFlagDialogProps) {
  const [key, setKey] = useState(flag.key);
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description || '');
  const [isEnabled, setIsEnabled] = useState(flag.isEnabled);
  const [enabledForPlans, setEnabledForPlans] = useState<string[]>(flag.enabledForPlans || []);
  const [enabledForOrganizations, setEnabledForOrganizations] = useState<string[]>(
    flag.enabledForOrganizations || []
  );
  const [rolloutPercentage, setRolloutPercentage] = useState(flag.rolloutPercentage);

  const { toast } = useToast();
  const updateFeatureFlag = useUpdateFeatureFlag();

  useEffect(() => {
    setKey(flag.key);
    setName(flag.name);
    setDescription(flag.description || '');
    setIsEnabled(flag.isEnabled);
    setEnabledForPlans(flag.enabledForPlans || []);
    setEnabledForOrganizations(flag.enabledForOrganizations || []);
    setRolloutPercentage(flag.rolloutPercentage);
  }, [flag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFeatureFlag.mutateAsync({
        flagId: flag.id,
        data: {
          key,
          name,
          description: description || undefined,
          isEnabled,
          enabledForPlans,
          enabledForOrganizations,
          rolloutPercentage,
        },
      });
      toast({ title: 'Feature flag updated', description: `"${name}" was updated successfully.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Failed to update feature flag',
        description: error.message || 'Something went wrong.',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit feature flag</DialogTitle>
            <DialogDescription>Update flag settings to control feature rollout.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Key</Label>
              <Input
                id="edit-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                pattern="[a-z0-9_-]+"
                required
              />
              <p className="text-xs text-muted-foreground">Lowercase, dashes or underscores only.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">Enable this flag globally.</p>
              </div>
              <Switch id="edit-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Plans</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((plan) => (
                  <label key={plan} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                    <Checkbox
                      id={`edit-plan-${plan}`}
                      checked={enabledForPlans.includes(plan)}
                      onCheckedChange={() => togglePlan(plan)}
                    />
                    {plan}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave empty to enable for all plans.</p>
            </div>

            <div className="space-y-2">
              <Label>Target organizations</Label>
              <OrganizationMultiSelect
                value={enabledForOrganizations}
                onChange={setEnabledForOrganizations}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to enable for all organizations matching the plan + rollout.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rollout">Rollout: {rolloutPercentage}%</Label>
              <input
                type="range"
                id="edit-rollout"
                min="0"
                max="100"
                step="5"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateFeatureFlag.isPending}>
              {updateFeatureFlag.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
