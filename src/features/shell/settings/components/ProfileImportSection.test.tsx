// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { ProfileImportSection } from "./ProfileImportSection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../../../shared/lib/app-dialogs", () => ({
  showConfirmDialog: vi.fn(),
}));

vi.mock("../../../../shared/api/profile-api", () => ({
  profileApi: {
    importProfile: vi.fn(),
    importProfileFile: vi.fn(),
  },
}));

const toastError = vi.mocked(await import("sonner")).toast.error;

describe("ProfileImportSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.setState({ remoteRuntimeUrl: "" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("renders with an invalid remote runtime URL and reports the click-time error", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://[bad" });

    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ProfileImportSection />
        </QueryClientProvider>,
      );
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Import Profile (JSON)");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toastError).toHaveBeenCalledWith("Invalid Remote Runtime URL. Check Settings and enter a valid runtime URL.");
  });
});
