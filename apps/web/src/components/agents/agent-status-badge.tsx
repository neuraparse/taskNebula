'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AgentExecutionStatus =
  | 'queued'
  | 'setup_pending'
  | 'setup_in_progress'
  | 'executing'
  | 'committing'
  | 'pushing'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface AgentStatusBadgeProps {
  status: AgentExecutionStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<AgentExecutionStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ElementType;
  className: string;
}> = {
  queued: {
    label: 'Queued',
    variant: 'secondary',
    icon: Clock,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  setup_pending: {
    label: 'Setup Pending',
    variant: 'secondary',
    icon: Clock,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  setup_in_progress: {
    label: 'Setting Up',
    variant: 'default',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  executing: {
    label: 'Executing',
    variant: 'default',
    icon: Loader2,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  committing: {
    label: 'Committing',
    variant: 'default',
    icon: Loader2,
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  },
  pushing: {
    label: 'Pushing',
    variant: 'default',
    icon: Loader2,
    className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'secondary',
    icon: AlertCircle,
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
};

export function AgentStatusBadge({
  status,
  className,
  showIcon = true
}: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimating = ['setup_in_progress', 'executing', 'committing', 'pushing'].includes(status);

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1.5 font-medium',
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            isAnimating && 'animate-spin'
          )}
        />
      )}
      <span>{config.label}</span>
    </Badge>
  );
}
