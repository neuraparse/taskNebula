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
  metadata: Record<string, any>;
}

interface EditFeatureFlagDialogProps {
  flag: FeatureFlag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFeatureFlagDialog({
  flag,
  open,
  onOpenChange,
}: EditFeatureFlagDialogProps) {
  const [key, setKey] = useState(flag.key);
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description || '');
  const [isEnabled, setIsEnabled] = useState(flag.isEnabled);
  const [enabledForPlans, setEnabledForPlans] = useState<string[]>(flag.enabledForPlans || []);
  const [rolloutPercentage, setRolloutPercentage] = useState(flag.rolloutPercentage);

  const { toast } = useToast();
  const updateFeatureFlag = useUpdateFeatureFlag();

  // Update form when flag changes
  useEffect(() => {
    setKey(flag.key);
    setName(flag.name);
    setDescription(flag.description || '');
    setIsEnabled(flag.isEnabled);
    setEnabledForPlans(flag.enabledForPlans || []);
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
          rolloutPercentage,
        },
      });

      toast({
        title: 'Feature flag updated',
        description: `Feature flag "${name}" has been updated successfully.`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update feature flag',
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
            <DialogDescription>
              Update feature flag settings to control feature rollout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Key *</Label>
              <Input
                id="edit-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                pattern="[a-z0-9_-]+"
                required
              />
              <p className="text-xs text-muted-foreground">
                Lowercase alphanumeric with dashes or underscores
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
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
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this feature flag globally
                </p>
              </div>
              <Switch
                id="edit-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Enabled for Plans</Label>
              <div className="grid grid-cols-2 gap-3">
                {PLANS.map((plan) => (
                  <div key={plan} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-plan-${plan}`}
                      checked={enabledForPlans.includes(plan)}
                      onCheckedChange={() => togglePlan(plan)}
                    />
                    <label
                      htmlFor={`edit-plan-${plan}`}
                      className="text-sm font-medium capitalize cursor-pointer"
                    >
                      {plan}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to enable for all plans
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rollout">Rollout Percentage: {rolloutPercentage}%</Label>
              <input
                type="range"
                id="edit-rollout"
                min="0"
                max="100"
                step="5"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Gradually roll out to a percentage of organizations
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateFeatureFlag.isPending}>
              {updateFeatureFlag.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

