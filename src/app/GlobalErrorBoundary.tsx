import { Component, type ErrorInfo, type ReactNode } from "react";

type GlobalErrorBoundaryState = {
  error: unknown;
  componentStack: string;
  copyStatus: "idle" | "copied" | "failed";
};

type GlobalErrorBoundaryProps = {
  children: ReactNode;
  onReload?: () => void;
};

const reactRootUncaughtErrors = new WeakSet<object>();
let globalDiagnosticsInstalled = false;

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

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
  if (type === "uncaught" && isObject(error)) {
    reactRootUncaughtErrors.add(error);
  }

  console.error(`[Marinara] React ${type} error`, error, {
    componentStack: errorInfo?.componentStack ?? "",
  });
}

export function installGlobalErrorDiagnostics() {
  if (globalDiagnosticsInstalled || typeof window === "undefined") return;
  globalDiagnosticsInstalled = true;

  window.addEventListener("error", (event) => {
    if (isObject(event.error) && reactRootUncaughtErrors.has(event.error)) return;

    console.error("[Marinara] Unhandled window error", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Marinara] Unhandled promise rejection", event.reason);
  });
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    error: null,
    componentStack: "",
    copyStatus: "idle",
  };

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
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }

    window.location.reload();
  };

  private copyDebugDetails = () => {
    const debugDetails = buildDebugDetails(this.state.error, this.state.componentStack);
    const writeText = navigator.clipboard?.writeText;

    if (typeof writeText !== "function") {
      this.setState({ copyStatus: "failed" });
      return;
    }

    const writePromise = writeText.call(navigator.clipboard, debugDetails);

    void writePromise
      .then(() => this.setState({ copyStatus: "copied" }))
      .catch(() => this.setState({ copyStatus: "failed" }));
  };

  render() {
    if (this.state.error) {
      const details = describeError(this.state.error);
      const debugDetails = buildDebugDetails(this.state.error, this.state.componentStack);
      const buttonStyle = {
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: "0.5rem",
        cursor: "pointer",
        fontSize: "0.875rem",
        fontWeight: 600,
        padding: "0.625rem 0.875rem",
      };

      return (
        <main
          role="alert"
          style={{
            alignItems: "center",
            background: "var(--background, #09090b)",
            color: "var(--foreground, #f8fafc)",
            display: "flex",
            minHeight: "100vh",
            padding: "1rem",
          }}
        >
          <section
            aria-labelledby="global-error-title"
            aria-live="assertive"
            style={{
              background: "var(--card, #111113)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
              borderRadius: "0.5rem",
              boxShadow: "0 1.5rem 4rem rgba(0, 0, 0, 0.34)",
              margin: "0 auto",
              maxWidth: "42rem",
              padding: "1.5rem",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "var(--destructive, #f87171)",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                margin: "0 0 0.5rem",
                textTransform: "uppercase",
              }}
            >
              Marinara crashed
            </p>
            <h1 id="global-error-title" style={{ fontSize: "1.25rem", lineHeight: 1.3, margin: "0 0 0.75rem" }}>
              Something went wrong while rendering the app.
            </h1>
            <p style={{ color: "var(--muted-foreground, #a1a1aa)", lineHeight: 1.6, margin: "0 0 1rem" }}>
              Reload Marinara to keep working, or copy the debug details below when reporting the issue.
            </p>

            <div
              style={{
                border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                padding: "0.75rem",
              }}
            >
              <p style={{ fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.25rem" }}>{details.name}</p>
              <p
                style={{
                  color: "var(--muted-foreground, #a1a1aa)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.8125rem",
                  margin: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {details.message}
              </p>
            </div>

            <details style={{ marginBottom: "1rem" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>Debug details</summary>
              <pre
                style={{
                  background: "rgba(0, 0, 0, 0.28)",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
                  borderRadius: "0.5rem",
                  color: "var(--foreground, #f8fafc)",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                  margin: "0.75rem 0 0",
                  maxHeight: "18rem",
                  overflow: "auto",
                  padding: "0.75rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {debugDetails}
              </pre>
            </details>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={this.reloadApp}
                style={{
                  ...buttonStyle,
                  background: "var(--primary, #f97316)",
                  color: "white",
                }}
              >
                Reload app
              </button>
              <button
                type="button"
                onClick={this.copyDebugDetails}
                style={{
                  ...buttonStyle,
                  background: "transparent",
                  color: "var(--foreground, #f8fafc)",
                }}
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

    return this.props.children;
  }
}
