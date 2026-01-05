'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PlanUpgradeDialog } from './plan-upgrade-dialog';

interface UpgradePromptProps {
  title: string;
  description: string;
  organizationId: string;
  currentPlan: 'free' | 'starter' | 'growth' | 'enterprise';
  feature?: string;
}

export function UpgradePrompt({ 
  title, 
  description, 
  organizationId, 
  currentPlan,
  feature 
}: UpgradePromptProps) {
  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900 dark:text-orange-100">{title}</AlertTitle>
      <AlertDescription className="text-orange-800 dark:text-orange-200">
        <p className="mb-3">{description}</p>
        <PlanUpgradeDialog
          organizationId={organizationId}
          currentPlan={currentPlan}
          trigger={
            <Button size="sm" variant="default" className="bg-orange-600 hover:bg-orange-700">
              Upgrade Plan
            </Button>
          }
        />
      </AlertDescription>
    </Alert>
  );
}

