// WhatsApp Error Boundary
// =======================
// Wraps the WhatsApp inbox (and other WhatsApp pages) so a runtime render error
// shows a visible, recoverable error state instead of white-screening the whole
// app. React has no hook-based error boundary, so this must be a class component.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppErrorBoundaryProps {
  children: ReactNode;
  /** Optional label used in the fallback copy, e.g. "Inbox". */
  label?: string;
}

interface WhatsAppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WhatsAppErrorBoundary extends Component<
  WhatsAppErrorBoundaryProps,
  WhatsAppErrorBoundaryState
> {
  constructor(props: WhatsAppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WhatsAppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log so the crash is still diagnosable in the console / error reporting.
    console.error('[WhatsAppErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.label ?? 'this page';

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-5 rounded-2xl border bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500">
              We hit an unexpected error while loading {label}. Your data is safe — try again.
            </p>
            {this.state.error?.message && (
              <p className="mx-auto max-w-full break-words rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-400">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={this.handleReload}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default WhatsAppErrorBoundary;
