'use client';

import { Component, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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

      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error | null }) {
  const t = useTranslations('errorPages');

  return (
    <div className="animate-fade-up flex min-h-[320px] flex-col items-center justify-center gap-4 p-8">
      <div className="bg-destructive/10 rounded-full p-3">
        <AlertTriangle className="text-destructive h-8 w-8" aria-hidden />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold">{t('boundary.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('boundary.description')}</p>
      </div>

      <Button onClick={() => window.location.reload()} size="sm">
        <RefreshCw className="mr-2 h-4 w-4" />
        {t('boundary.reload')}
      </Button>

      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-2 w-full max-w-xl">
          <summary className="text-muted-foreground cursor-pointer text-xs font-medium">
            {t('boundary.detailsDev')}
          </summary>
          <pre className="bg-surface text-muted-foreground mt-2 overflow-auto rounded-md p-3 text-[11px]">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  const t = useTranslations('errorPages');

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[160px] items-center justify-center">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <AlertTriangle className="text-destructive h-4 w-4" aria-hidden />
            {t('failedToLoadContent')}
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
  const t = useTranslations('errorPages');

  return (
    <ErrorBoundary
      fallback={
        <div className="border-destructive/20 bg-destructive/5 rounded-md border px-3 py-2">
          <div className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-sm">
              {sectionName
                ? t('failedToLoadSectionNamed', { section: sectionName })
                : t('failedToLoadSection')}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
