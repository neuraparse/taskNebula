import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/10 text-primary',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-destructive/20 bg-destructive/10 text-destructive',
        outline:
          'text-foreground border-border',
        success:
          'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald',
        warning:
          'border-accent-amber/20 bg-accent-amber/10 text-accent-amber',
        info:
          'border-accent-blue/20 bg-accent-blue/10 text-accent-blue',
        muted:
          'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        sm: 'px-1.5 py-0 text-[10px]',
        lg: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
