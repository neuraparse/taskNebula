import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:flex-col md:max-w-[380px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  [
    // layout + base card
    'group pointer-events-auto relative flex w-full max-w-[380px] items-start gap-3 overflow-hidden rounded-xl border border-border/60 p-4 pr-10 pl-5',
    // surface: card bg with subtle translucency + backdrop blur (falls back gracefully)
    'bg-card/85 text-foreground shadow-lg supports-[backdrop-filter]:bg-card/70 supports-[backdrop-filter]:backdrop-blur-md',
    // gradient left stripe (variant tints override the gradient color vars below)
    "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-gradient-to-b before:from-[var(--toast-stripe-from)] before:to-[var(--toast-stripe-to)] before:content-['']",
    // motion
    'transition-all duration-200 ease-snap',
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=move]:transition-none',
    // enter: slide from right + fade/scale in
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-6 data-[state=open]:zoom-in-95',
    // exit: fade + scale + slide
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-right-full',
    'data-[swipe=end]:animate-out',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          '[--toast-stripe-from:hsl(var(--accent-indigo))] [--toast-stripe-to:hsl(var(--accent-violet))]',
        info: '[--toast-stripe-from:hsl(var(--accent-blue))] [--toast-stripe-to:hsl(var(--accent-indigo))]',
        destructive:
          'destructive border-destructive/40 [--toast-stripe-from:hsl(var(--destructive))] [--toast-stripe-to:hsl(var(--accent-rose))]',
        success:
          '[--toast-stripe-from:hsl(var(--accent-emerald))] [--toast-stripe-to:hsl(var(--accent-cyan))]',
        warning:
          '[--toast-stripe-from:hsl(var(--accent-amber))] [--toast-stripe-to:hsl(var(--accent-rose))]',
        pop: '[--toast-stripe-from:hsl(var(--accent-indigo))] [--toast-stripe-to:hsl(var(--accent-violet))] data-[state=open]:animate-pop-in',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type ToastVariant = NonNullable<VariantProps<typeof toastVariants>['variant']>;

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="text-accent-indigo h-4 w-4" aria-hidden="true" />,
  info: <Info className="text-accent-blue h-4 w-4" aria-hidden="true" />,
  destructive: <XCircle className="text-destructive h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="text-accent-emerald h-4 w-4" aria-hidden="true" />,
  warning: <AlertTriangle className="text-accent-amber h-4 w-4" aria-hidden="true" />,
  pop: <Info className="text-accent-violet h-4 w-4" aria-hidden="true" />,
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      /** Hide the auto-injected variant icon */
      hideIcon?: boolean;
    }
>(({ className, variant, hideIcon, children, ...props }, ref) => {
  const resolvedVariant = (variant ?? 'default') as ToastVariant;
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {!hideIcon && (
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {variantIcon[resolvedVariant]}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">{children}</div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'border-border/70 text-foreground ring-offset-background inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors duration-150',
      'hover:border-accent-indigo/50 hover:bg-accent-indigo/10 hover:text-accent-indigo',
      'focus-visible:ring-accent-indigo focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'group-[.destructive]:border-destructive/40 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus-visible:ring-destructive',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => {
  const t = useTranslations('uiCommon');
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={cn(
        'text-muted-foreground absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all duration-150',
        'hover:bg-muted/60 hover:text-foreground',
        'focus-visible:ring-accent-indigo focus-visible:ring-offset-background focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'group-hover:opacity-100',
        'group-[.destructive]:text-destructive/80 group-[.destructive]:hover:bg-destructive/10 group-[.destructive]:hover:text-destructive group-[.destructive]:focus-visible:ring-destructive',
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-3.5 w-3.5" />
      <span className="sr-only">{t('close')}</span>
    </ToastPrimitives.Close>
  );
});
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      'text-foreground text-[14px] font-semibold leading-snug tracking-tight',
      className
    )}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-muted-foreground mt-0.5 text-[13px] leading-relaxed', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
