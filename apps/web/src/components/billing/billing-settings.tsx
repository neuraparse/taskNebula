'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CreditCard, Calendar, Users, FolderKanban, FileText, Webhook, Shield } from 'lucide-react';
import { PlanUpgradeDialog } from './plan-upgrade-dialog';
import { useToast } from '@/hooks/use-toast';
import { PLAN_PRICING } from '@/lib/stripe';

interface OrganizationUsage {
  members: number;
  projects: number;
  customFields: number;
  webhooks: number;
  teams: number;
}

interface OrganizationLimits {
  maxMembers: number;
  maxProjects: number;
  maxCustomFields: number;
  maxWebhooks: number;
  maxTeams: number;
}

export function BillingSettings() {
  const { currentOrganization } = useOrganization();
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [limits, setLimits] = useState<OrganizationLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchUsageAndLimits();
    }
  }, [currentOrganization?.id]);

  const fetchUsageAndLimits = async () => {
    try {
      const response = await fetch(`/api/organizations/${currentOrganization?.id}/usage`);
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
        setLimits(data.limits);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization?.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to open billing portal',
        variant: 'destructive',
      });
      setPortalLoading(false);
    }
  };

  if (loading || !currentOrganization) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plan = currentOrganization.plan || 'free';
  const planInfo = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];

  const usageItems = [
    {
      icon: Users,
      label: 'Team Members',
      current: usage?.members || 0,
      limit: limits?.maxMembers || 0,
      color: 'text-blue-500',
    },
    {
      icon: FolderKanban,
      label: 'Projects',
      current: usage?.projects || 0,
      limit: limits?.maxProjects || 0,
      color: 'text-green-500',
    },
    {
      icon: FileText,
      label: 'Custom Fields',
      current: usage?.customFields || 0,
      limit: limits?.maxCustomFields || 0,
      color: 'text-purple-500',
    },
    {
      icon: Webhook,
      label: 'Webhooks',
      current: usage?.webhooks || 0,
      limit: limits?.maxWebhooks || 0,
      color: 'text-orange-500',
    },
    {
      icon: Shield,
      label: 'Teams',
      current: usage?.teams || 0,
      limit: limits?.maxTeams || 0,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-4 py-1">
              {planInfo.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan !== 'free' && currentOrganization.stripeCurrentPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Renews on {new Date(currentOrganization.stripeCurrentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            {plan !== 'free' && (
              <Button onClick={handleManageBilling} disabled={portalLoading}>
                {portalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Billing
                  </>
                )}
              </Button>
            )}
            {plan !== 'enterprise' && (
              <PlanUpgradeDialog
                organizationId={currentOrganization.id}
                currentPlan={plan as 'free' | 'starter' | 'growth' | 'enterprise'}
                trigger={
                  <Button variant={plan === 'free' ? 'default' : 'outline'}>
                    {plan === 'free' ? 'Upgrade Now' : 'Upgrade Plan'}
                  </Button>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
          <CardDescription>Track your organization's resource usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {usageItems.map((item) => {
            const Icon = item.icon;
            const isUnlimited = item.limit === -1;
            const percentage = isUnlimited ? 0 : (item.current / item.limit) * 100;
            const isNearLimit = percentage >= 80;

            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.current} / {isUnlimited ? '∞' : item.limit}
                  </span>
                </div>
                {!isUnlimited && (
                  <>
                    <Progress value={percentage} className="h-2" />
                    {isNearLimit && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        You're approaching your limit. Consider upgrading your plan.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

