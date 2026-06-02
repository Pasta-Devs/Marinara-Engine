// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAssetsBrowserView } from "./GameAssetsBrowserView";
import { useGameAssetTree } from "../hooks/use-game-assets";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ──────────────────────────────────────────────
// Seam under test: the view consumes useGameAssetTree() and is responsible
// for turning a rejected tree query into an error message + Retry button.
// We mock the whole hook module so the tree query reports isError, while the
// remaining mutation hooks return inert stubs so the component can mount.
// ──────────────────────────────────────────────
const refetchMock = vi.fn();

function mutationStub() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined) };
}

vi.mock("../hooks/use-game-assets", () => ({
  useGameAssetTree: vi.fn(),
  useCreateGameAssetFolder: () => mutationStub(),
  useDeleteGameAssetFolder: () => mutationStub(),
  useRenameGameAsset: () => mutationStub(),
  useMoveGameAsset: () => mutationStub(),
  useCopyGameAsset: () => mutationStub(),
  useDeleteGameAsset: () => mutationStub(),
  useOpenGameAssetsFolder: () => mutationStub(),
  useRescanGameAssets: () => mutationStub(),
  useUploadGameAsset: () => mutationStub(),
  useUpdateFolderDescription: () => mutationStub(),
  useSaveGameAssetFile: () => mutationStub(),
  useMoveGameAssetsBulk: () => mutationStub(),
  useCopyGameAssetsBulk: () => mutationStub(),
  useDeleteGameAssetsBulk: () => mutationStub(),
}));

// Chats index pulls in the full LLM/engine generation graph; stub the two hooks
// the view actually calls so mounting stays in jsdom.
vi.mock("../../../catalog/chats/index", () => ({
  useChat: () => ({ data: undefined }),
  useUpdateChatMetadata: () => mutationStub(),
}));

// local-file-api imports @tauri-apps/api at module load.
vi.mock("../../../../shared/api/local-file-api", () => ({
  resolveGameAssetFileUrl: vi.fn(async (path: string) => path),
}));

// chat-display is a pure helper but mocked for determinism.
vi.mock("../../../../shared/lib/chat-display", () => ({
  parseChatMetadata: () => ({}),
}));

// Zustand selector stores — provide the slices the view selects.
vi.mock("../../../../shared/stores/ui.store", () => ({
  useUIStore: (selector: (state: { closeGameAssetsBrowser: () => void; gameAssetsBrowserOpen: boolean }) => unknown) =>
    selector({ closeGameAssetsBrowser: vi.fn(), gameAssetsBrowserOpen: true }),
}));

vi.mock("../../../../shared/stores/chat.store", () => ({
  useChatStore: (selector: (state: { activeChatId: string | null }) => unknown) => selector({ activeChatId: null }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const useGameAssetTreeMock = vi.mocked(useGameAssetTree);

describe("GameAssetsBrowserView tree-load error UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    refetchMock.mockReset();
    useGameAssetTreeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("tree blew up"),
      refetch: refetchMock,
    } as unknown as ReturnType<typeof useGameAssetTree>);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("renders a retryable error instead of a blank/empty state when the tree query fails", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <GameAssetsBrowserView />
        </QueryClientProvider>,
      );
    });

    // Sidebar surfaces the failure...
    expect(container.textContent).toContain("Failed to load game assets");
    // ...and the main pane shows the underlying error message.
    expect(container.textContent).toContain("tree blew up");

    // A Retry button must exist (pre-fix the error branch did not render one).
    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    expect(retryButton).toBeTruthy();

    // Clicking Retry is wired to the query's refetch.
    await act(async () => {
      retryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
