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
const toastSuccess = vi.mocked(await import("sonner")).toast.success;
const importProfile = (await import("../../../../shared/api/profile-api")).profileApi
  .importProfile as unknown as ReturnType<typeof vi.fn>;
const showConfirmDialog = vi.mocked(await import("../../../../shared/lib/app-dialogs")).showConfirmDialog;

async function changeProfileFileInput(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

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

    expect(toastError).toHaveBeenCalledWith(
      "Invalid Remote Runtime URL. Check Settings and enter a valid runtime URL.",
    );
  });

  it("imports a remote profile JSON file through the shared profile API", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://localhost:4111" });
    showConfirmDialog.mockResolvedValue(true);
    importProfile.mockResolvedValue({ success: true, imported: { characters: 1 } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ProfileImportSection />
        </QueryClientProvider>,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();

    await changeProfileFileInput(
      input!,
      new File([JSON.stringify({ version: 1, characters: [] })], "profile.json", { type: "application/json" }),
    );

    await vi.waitFor(() => {
      expect(importProfile).toHaveBeenCalledWith({ version: 1, characters: [] });
    });
    expect(showConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({ title: "Import Profile" }));
    expect(toastSuccess).toHaveBeenCalledWith("Imported: 1 characters");
  });

  it("reports a SyntaxError toast when a remote profile JSON file cannot be parsed", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://localhost:4111" });
    showConfirmDialog.mockResolvedValue(true);

    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ProfileImportSection />
        </QueryClientProvider>,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();

    await changeProfileFileInput(input!, new File(["{"], "profile.json", { type: "application/json" }));

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Import failed. Make sure this is a valid profile JSON file.");
    });
    expect(importProfile).not.toHaveBeenCalled();
  });
});
