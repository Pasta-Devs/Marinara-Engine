// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresetEditor } from "./PresetEditor";
import { useUIStore } from "../../../../shared/stores/ui.store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const presetHookMocks = vi.hoisted(() => ({
  full: {
    data: {
      preset: {
        id: "preset-1",
        name: "Story preset",
        description: "Original description",
        wrapFormat: "xml",
        author: "Celia",
        parameters: {},
        sectionOrder: [],
      },
      sections: [],
      groups: [],
      choiceBlocks: [],
    },
    isLoading: false,
  },
  updatePreset: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
  deletePreset: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
  nestedMutation: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("../hooks/use-presets", () => ({
  usePresetFull: () => presetHookMocks.full,
  useUpdatePreset: () => presetHookMocks.updatePreset,
  useDeletePreset: () => presetHookMocks.deletePreset,
  useCreateSection: () => presetHookMocks.nestedMutation,
  useUpdateSection: () => presetHookMocks.nestedMutation,
  useDeleteSection: () => presetHookMocks.nestedMutation,
  useReorderSections: () => presetHookMocks.nestedMutation,
  useCreateGroup: () => presetHookMocks.nestedMutation,
  useUpdateGroup: () => presetHookMocks.nestedMutation,
  useDeleteGroup: () => presetHookMocks.nestedMutation,
  useCreateVariable: () => presetHookMocks.nestedMutation,
  useUpdateVariable: () => presetHookMocks.nestedMutation,
  useDeleteVariable: () => presetHookMocks.nestedMutation,
  useReorderVariables: () => presetHookMocks.nestedMutation,
}));

vi.mock("../../chats/index", () => ({
  useChat: () => ({ data: undefined }),
}));

vi.mock("../../agents/index", () => ({
  useAgentConfigs: () => ({ data: [] }),
}));

vi.mock("../../../../shared/api/export-api", () => ({
  exportApi: {
    prompt: vi.fn(),
    triggerDownload: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/integration-utility-api", () => ({
  connectionsUtilityApi: {
    list: vi.fn(async () => []),
  },
}));

vi.mock("../../../../engine/generation/prompt-reviewer", () => ({
  reviewPromptPreset: vi.fn(),
}));

vi.mock("../../../../shared/api/llm-api", () => ({
  llmApi: {},
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {},
}));

vi.mock("../../../../shared/lib/app-dialogs", () => ({
  showConfirmDialog: vi.fn(async () => false),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

describe("PresetEditor Save & close", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    presetHookMocks.updatePreset.mutate.mockReset();
    presetHookMocks.updatePreset.mutateAsync.mockReset();
    presetHookMocks.updatePreset.isPending = false;
    presetHookMocks.deletePreset.mutate.mockReset();
    presetHookMocks.nestedMutation.mutate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useUIStore.setState({ presetDetailId: "preset-1", editorDirty: false });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    useUIStore.setState({ presetDetailId: null, editorDirty: false });
    window.localStorage.clear();
  });

  it("keeps the editor open when Save & close fails and closes after a successful retry", async () => {
    presetHookMocks.updatePreset.mutateAsync
      .mockRejectedValueOnce(new Error("simulated preset write failure"))
      .mockResolvedValueOnce({ id: "preset-1" });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PresetEditor />
        </QueryClientProvider>,
      );
    });

    const headerNameInput = [...container.querySelectorAll<HTMLInputElement>("input")].find(
      (input) => input.value === "Story preset",
    );
    expect(headerNameInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(headerNameInput, "Story preset edited");
      headerNameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const backButton = container.querySelector<HTMLButtonElement>("button");
    expect(backButton).toBeTruthy();
    await act(async () => {
      backButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveAndClose = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Save & close"),
    );
    expect(saveAndClose).toBeTruthy();

    await act(async () => {
      saveAndClose!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(presetHookMocks.updatePreset.mutateAsync).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().presetDetailId).toBe("preset-1");
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].some((input) => input.value === "Story preset edited"),
    ).toBe(true);
    expect(container.textContent).toContain("simulated preset write failure");

    const retrySaveAndClose = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Save & close"),
    );
    expect(retrySaveAndClose).toBeTruthy();

    await act(async () => {
      retrySaveAndClose!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(presetHookMocks.updatePreset.mutateAsync).toHaveBeenCalledTimes(2);
    expect(useUIStore.getState().presetDetailId).toBeNull();
  });
});
