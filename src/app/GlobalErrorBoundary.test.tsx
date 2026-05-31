// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalErrorBoundary, installGlobalErrorDiagnostics, reportReactRootError } from "./GlobalErrorBoundary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function BrokenChild(): ReactNode {
  throw new Error("render exploded");
}

describe("GlobalErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("renders children while no render error has occurred", () => {
    act(() => {
      root.render(
        <GlobalErrorBoundary>
          <div data-testid="healthy-app">App ready</div>
        </GlobalErrorBoundary>,
      );
    });

    expect(container.querySelector("[data-testid='healthy-app']")?.textContent).toBe("App ready");
    expect(container.textContent).not.toContain("Marinara crashed");
  });

  it("shows a recoverable crash screen with debug details when a child render throws", () => {
    act(() => {
      root.render(
        <GlobalErrorBoundary>
          <BrokenChild />
        </GlobalErrorBoundary>,
      );
    });

    expect(container.querySelector("[role='alert']")).not.toBeNull();
    expect(container.textContent).toContain("Marinara crashed");
    expect(container.textContent).toContain("Something went wrong while rendering the app.");
    expect(container.textContent).toContain("render exploded");
    expect(container.textContent).toContain("Debug details");
  });

  it("copies debug details from the fallback without app shell services", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    act(() => {
      root.render(
        <GlobalErrorBoundary>
          <BrokenChild />
        </GlobalErrorBoundary>,
      );
    });

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy debug details"),
    );
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("render exploded"));
    expect(container.textContent).toContain("Copied debug details");
  });

  it("shows copy failure when clipboard writeText is unavailable", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });

    act(() => {
      root.render(
        <GlobalErrorBoundary>
          <BrokenChild />
        </GlobalErrorBoundary>,
      );
    });

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy debug details"),
    );
    expect(copyButton).toBeDefined();

    act(() => {
      copyButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Copy failed");
  });

  it("runs the provided reload action from the fallback", () => {
    const onReload = vi.fn();

    act(() => {
      root.render(
        <GlobalErrorBoundary onReload={onReload}>
          <BrokenChild />
        </GlobalErrorBoundary>,
      );
    });

    const reloadButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Reload app"),
    );
    expect(reloadButton).toBeDefined();

    act(() => {
      reloadButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReload).toHaveBeenCalledOnce();
  });
});

describe("installGlobalErrorDiagnostics", () => {
  it("does not duplicate window error logs for React root uncaught errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("root exploded");

    installGlobalErrorDiagnostics();
    reportReactRootError("uncaught", error, { componentStack: "\n    at BrokenChild" });
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith("[Marinara] React uncaught error", error, {
      componentStack: "\n    at BrokenChild",
    });

    consoleErrorSpy.mockRestore();
  });
});
