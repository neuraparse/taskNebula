import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export const AUTH_INPUT_CLASS_NAME =
  'h-11 bg-background text-foreground !transition-colors duration-150';

export const AUTH_LINK_CLASS_NAME =
  'rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const AUTH_STANDALONE_LINK_CLASS_NAME = `${AUTH_LINK_CLASS_NAME} inline-flex min-h-11 items-center`;

interface AuthIntroProps {
  title: ReactNode;
  description: ReactNode;
  className?: string;
}

export function AuthIntro({ title, description, className }: AuthIntroProps) {
  return (
    <header className={cn('space-y-2', className)}>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-sm text-sm leading-6">{description}</p>
    </header>
  );
}

export function AuthFieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-destructive text-sm leading-5">
      {children}
    </p>
  );
}

export function AuthFormAlert({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Alert id={id} variant="destructive" className="rounded-lg">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center" role="status">
      <LoaderCircle className="text-primary h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      <span>{children}</span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
    </div>
  );
}
