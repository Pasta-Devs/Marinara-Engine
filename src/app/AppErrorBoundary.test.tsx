// @vitest-environment jsdom
import React, { act } from "react";
import ReactDOM from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function ThrowingChild(): React.ReactElement {
  throw new Error("echo chamber render exploded");
}

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a root fallback mounted when a child render throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReload = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      ReactDOM.createRoot(host).render(
        <AppErrorBoundary onReload={onReload}>
          <ThrowingChild />
        </AppErrorBoundary>,
      );
    });

    expect(host.textContent).toContain("Marinara stopped rendering");
    expect(host.textContent).toContain("echo chamber render exploded");
    expect(host.querySelector("[role='alert']")?.getAttribute("aria-live")).toBe("assertive");
    expect(host.querySelector("pre")?.getAttribute("aria-label")).toBe("Error details");

    host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onReload).toHaveBeenCalledOnce();
    host.remove();
  });
});
