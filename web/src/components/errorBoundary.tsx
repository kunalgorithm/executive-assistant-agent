import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  featureName?: string; // Name of the feature wrapped by this boundary for better error context
};

type ErrorBoundaryState = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.props.onError?.(error, errorInfo);

    // In production, send this to an error tracking service like Sentry
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-100 flex-col items-center justify-center p-8">
          <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>

            <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>

            <p className="mb-4 text-sm text-muted-foreground">
              {this.props.featureName
                ? `An error occurred in ${this.props.featureName}. Please try again.`
                : 'An unexpected error occurred. Please try again.'}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs text-destructive">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex justify-center gap-3">
              <Button onClick={this.handleRetry} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <Button variant="outline" onClick={this.handleGoHome} size="sm">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function MinimalErrorFallback({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-700 dark:text-amber-300">{message || 'Failed to load this section'}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

type SectionErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  sectionName?: string;
  className?: string;
};

type SectionErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('SectionErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className={cn('rounded-lg border border-destructive/20 bg-destructive/5 p-4', this.props.className)}>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium">
                {this.props.sectionName ? `Error loading ${this.props.sectionName}` : 'Something went wrong'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">This section failed to load. Try refreshing.</p>
              {import.meta.env.DEV && this.state.error && (
                <p className="mt-1 text-xs text-destructive/70 truncate">{this.state.error.message}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={this.handleRetry} className="shrink-0">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// oxlint-disable-next-line react/only-export-components
export function withSectionErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionName?: string,
) {
  return function WithErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary sectionName={sectionName}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    );
  };
}
