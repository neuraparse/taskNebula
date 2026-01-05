'use client';

import { useState } from 'react';
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

const PLANS = ['free', 'starter', 'growth', 'enterprise'] as const;

export function CreateFeatureFlagDialog() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [enabledForPlans, setEnabledForPlans] = useState<string[]>([]);
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
        rolloutPercentage,
      });

      toast({
        title: 'Feature flag created',
        description: `Feature flag "${name}" has been created successfully.`,
      });

      // Reset form
      setKey('');
      setName('');
      setDescription('');
      setIsEnabled(false);
      setEnabledForPlans([]);
      setRolloutPercentage(0);
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create feature flag',
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
    <Dialog open={open} onOpenChange={(open: boolean) => setOpen(open)}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Feature Flag
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Create a new feature flag to control feature rollout across organizations and plans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key *</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="advanced_analytics"
                pattern="[a-z0-9_-]+"
                required
              />
              <p className="text-xs text-muted-foreground">
                Lowercase alphanumeric with dashes or underscores
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Advanced Analytics"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enable advanced analytics features including custom dashboards and reports"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this feature flag globally
                </p>
              </div>
              <Switch
                id="enabled"
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
                      id={`plan-${plan}`}
                      checked={enabledForPlans.includes(plan)}
                      onCheckedChange={() => togglePlan(plan)}
                    />
                    <label
                      htmlFor={`plan-${plan}`}
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
              <Label htmlFor="rollout">Rollout Percentage: {rolloutPercentage}%</Label>
              <input
                type="range"
                id="rollout"
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createFeatureFlag.isPending}>
              {createFeatureFlag.isPending ? 'Creating...' : 'Create Feature Flag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

