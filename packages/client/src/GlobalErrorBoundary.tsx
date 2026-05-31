import { Component, type ErrorInfo, type ReactNode } from "react";

type GlobalErrorBoundaryState = {
  error: unknown;
  componentStack: string;
  copyStatus: "idle" | "copied" | "failed";
};

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

const EMPTY_STATE: GlobalErrorBoundaryState = {
  error: null,
  componentStack: "",
  copyStatus: "idle",
};

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack ?? "",
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unknown error",
    stack: "",
  };
}

function buildDebugDetails(error: unknown, componentStack: string) {
  const details = describeError(error);
  const parts = [`${details.name}: ${details.message}`];

  if (details.stack) {
    parts.push(`Stack:\n${details.stack}`);
  }

  if (componentStack) {
    parts.push(`Component stack:\n${componentStack}`);
  }

  return parts.join("\n\n");
}

export function reportReactRootError(
  type: "caught" | "uncaught" | "recoverable",
  error: unknown,
  errorInfo?: ErrorInfo,
) {
  console.error(`[Marinara] React ${type} error`, error, {
    componentStack: errorInfo?.componentStack ?? "",
  });
}

let globalDiagnosticsInstalled = false;

export function installGlobalErrorDiagnostics() {
  if (globalDiagnosticsInstalled || typeof window === "undefined") return;
  globalDiagnosticsInstalled = true;

  window.addEventListener("error", (event) => {
    console.error("[Marinara] Unhandled window error", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Marinara] Unhandled promise rejection", event.reason);
  });
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state = EMPTY_STATE;

  static getDerivedStateFromError(error: unknown): Partial<GlobalErrorBoundaryState> {
    return {
      error,
      copyStatus: "idle",
    };
  }

  componentDidCatch(_error: unknown, errorInfo: ErrorInfo) {
    this.setState({
      componentStack: errorInfo.componentStack ?? "",
    });
  }

  private reloadApp = () => {
    window.location.reload();
  };

  private copyDebugDetails = () => {
    const debugDetails = buildDebugDetails(this.state.error, this.state.componentStack);
    const writePromise = navigator.clipboard?.writeText(debugDetails);

    if (!writePromise) {
      this.setState({ copyStatus: "failed" });
      return;
    }

    void writePromise
      .then(() => this.setState({ copyStatus: "copied" }))
      .catch(() => this.setState({ copyStatus: "failed" }));
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const details = describeError(this.state.error);
    const debugDetails = buildDebugDetails(this.state.error, this.state.componentStack);

    return (
      <main
        role="alert"
        className="flex min-h-screen items-center bg-[var(--background,#09090b)] p-4 text-[var(--foreground,#f8fafc)]"
      >
        <section className="mx-auto w-full max-w-2xl rounded-xl border border-[var(--border,rgba(255,255,255,0.12))] bg-[var(--card,#111113)] p-6 shadow-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--destructive,#f87171)]">
            Marinara crashed
          </p>
          <h1 className="mb-3 text-xl font-semibold leading-tight">Something went wrong while rendering the app.</h1>
          <p className="mb-4 leading-relaxed text-[var(--muted-foreground,#a1a1aa)]">
            Reload Marinara to keep working, or copy the debug details below when reporting the issue.
          </p>

          <div className="mb-4 rounded-lg border border-[var(--border,rgba(255,255,255,0.12))] p-3">
            <p className="mb-1 text-xs font-bold">{details.name}</p>
            <p className="break-words font-mono text-[0.8125rem] text-[var(--muted-foreground,#a1a1aa)]">
              {details.message}
            </p>
          </div>

          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-semibold">Debug details</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border,rgba(255,255,255,0.12))] bg-black/30 p-3 text-xs leading-relaxed text-[var(--foreground,#f8fafc)]">
              {debugDetails}
            </pre>
          </details>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reloadApp}
              className="rounded-lg border border-white/15 bg-[var(--primary,#f97316)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={this.copyDebugDetails}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/10"
            >
              {this.state.copyStatus === "copied"
                ? "Copied debug details"
                : this.state.copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy debug details"}
            </button>
          </div>
        </section>
      </main>
    );
  }
}
