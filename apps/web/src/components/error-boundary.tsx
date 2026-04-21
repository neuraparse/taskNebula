'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 animate-fade-up">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error occurred. Try reloading the page.
            </p>
          </div>

          <Button onClick={() => window.location.reload()} size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload page
          </Button>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-2 max-w-xl w-full">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Error details (dev only)
              </summary>
              <pre className="mt-2 overflow-auto rounded-md bg-surface p-3 text-[11px] text-muted-foreground">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[160px] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            Failed to load content
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function SectionErrorBoundary({
  children,
  sectionName,
}: {
  children: ReactNode;
  sectionName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-sm">
              {sectionName ? `Failed to load ${sectionName}` : 'Failed to load section'}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
