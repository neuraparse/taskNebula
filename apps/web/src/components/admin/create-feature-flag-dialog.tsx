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
      toast({ title: 'Feature flag created', description: `"${name}" was created successfully.` });
      setKey('');
      setName('');
      setDescription('');
      setIsEnabled(false);
      setEnabledForPlans([]);
      setRolloutPercentage(0);
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Failed to create feature flag',
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New flag
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create feature flag</DialogTitle>
            <DialogDescription>
              Control feature rollout across organizations and plans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="advanced_analytics"
                pattern="[a-z0-9_-]+"
                required
              />
              <p className="text-xs text-muted-foreground">Lowercase, dashes or underscores only.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
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
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">Enable globally on creation.</p>
              </div>
              <Switch id="enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Plans</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((plan) => (
                  <label key={plan} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                    <Checkbox
                      id={`plan-${plan}`}
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
              <Label htmlFor="rollout">Rollout: {rolloutPercentage}%</Label>
              <input
                type="range"
                id="rollout"
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFeatureFlag.isPending}>
              {createFeatureFlag.isPending ? 'Creating...' : 'Create flag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
