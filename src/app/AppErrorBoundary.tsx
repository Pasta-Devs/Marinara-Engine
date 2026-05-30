import React from "react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  onReload?: () => void;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

function errorMessage(error: Error | null): string {
  return error?.message?.trim() || "Unknown render error";
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[app] root render error", error, info.componentStack);
  }

  private reload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section
          aria-labelledby="app-error-title"
          aria-live="assertive"
          className="max-w-xl space-y-5 rounded-lg border border-border bg-card p-6 shadow-xl"
          role="alert"
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-destructive">Marinara stopped rendering</p>
            <h1 id="app-error-title" className="text-2xl font-semibold">
              The app hit an unrecoverable UI error.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Reload the app to recover. If this keeps happening, include the error below in the bug report.
            </p>
          </div>
          <pre
            aria-label="Error details"
            className="max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground"
          >
            {errorMessage(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={this.reload}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Reload app
          </button>
        </section>
      </main>
    );
  }
}
