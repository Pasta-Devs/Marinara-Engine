// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterEditor } from "./CharacterEditor";
import { useCharacter } from "../hooks/use-characters";
import { useUIStore } from "../../../../shared/stores/ui.store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks ──
// The editor pulls every character data-hook from this module. We only need
// useCharacter to feed it a deliberately malformed card (no `extensions` key);
// the rest are stubbed to inert no-ops so the component mounts without touching
// the Tauri storage layer.
// Factories live INSIDE the mock closure: vi.mock is hoisted above any
// top-level const, so referencing outer variables here throws a ReferenceError.
vi.mock("../hooks/use-characters", () => {
  const noopMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  });
  const emptyQuery = () => ({ data: undefined, isLoading: false });
  return {
    useCharacter: vi.fn(),
    useUpdateCharacter: noopMutation,
    useUploadAvatar: noopMutation,
    useDeleteCharacter: noopMutation,
    useDuplicateCharacter: noopMutation,
    useCharacterGalleryImages: emptyQuery,
    useUploadCharacterGalleryImage: noopMutation,
    useDeleteCharacterGalleryImage: noopMutation,
    useCharacterVersions: () => ({ data: [], isLoading: false }),
    useRestoreCharacterVersion: noopMutation,
    useDeleteCharacterVersion: noopMutation,
  };
});

vi.mock("../../sprites/index", () => {
  const noopMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  });
  const emptyQuery = () => ({ data: undefined, isLoading: false });
  return {
    useCharacterSprites: emptyQuery,
    useUploadSprite: noopMutation,
    useUploadSprites: noopMutation,
    useDeleteSprite: noopMutation,
    useCleanupSavedSprites: noopMutation,
    useRestoreSpriteCleanupPoint: noopMutation,
    useSpriteCapabilities: emptyQuery,
    spriteKeys: {
      list: (id: string, ownerType = "character") => ["sprites", ownerType, id],
      capabilities: () => ["sprites", "capabilities"],
    },
  };
});

vi.mock("../../personas/index", () => {
  const noopMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  });
  return {
    useCreatePersona: noopMutation,
    useUploadPersonaAvatar: noopMutation,
  };
});

vi.mock("../hooks/use-start-chat-from-character", () => ({
  useStartChatFromCharacter: () => ({
    startChatFromCharacter: vi.fn(),
    isStartingChat: false,
  }),
}));

vi.mock("../../connections/index", () => ({
  useConnections: () => ({ data: [] }),
}));

vi.mock("../../lorebooks/index", () => ({
  useLorebook: () => ({ data: undefined, isLoading: false }),
  lorebookKeys: { all: ["lorebooks"] },
}));

vi.mock("../../../../shared/lib/app-dialogs", () => ({
  showConfirmDialog: vi.fn().mockResolvedValue(false),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const useCharacterMock = vi.mocked(useCharacter);

// A storage record whose `data` has NO `extensions` key — the exact shape that
// crashed the editor pre-fix at the bare `formData.extensions.*` reads.
const BROKEN_CHARACTER = {
  id: "char-broken",
  data: { name: "Broken", description: "x" },
  comment: "",
  avatarPath: null,
  spriteFolderPath: null,
};

describe("CharacterEditor malformed-card load", () => {
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
    // Point the editor at our broken character id.
    useUIStore.getState().openCharacterDetail("char-broken");
    useCharacterMock.mockReturnValue({
      data: BROKEN_CHARACTER,
      isLoading: false,
    } as unknown as ReturnType<typeof useCharacter>);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    useCharacterMock.mockReset();
    useUIStore.getState().closeCharacterDetail();
  });

  it("normalizes a card with no extensions key so the editor mounts instead of throwing", async () => {
    // Pre-fix the editor did `setFormData(char.data)` raw, leaving
    // formData.extensions === undefined; the first render then hit
    // `formData.extensions.fav` (and downstream `.avatarCrop` / `.talkativeness`)
    // and threw "Cannot read properties of undefined". The fix routes the raw
    // data through characterDataSchema.safeParse, which guarantees `extensions`.
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CharacterEditor />
        </QueryClientProvider>,
      );
    });

    // GREEN: the editor mounted and the name input reflects the loaded card.
    const nameInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.value === "Broken",
    );
    expect(nameInput).toBeTruthy();
    expect(nameInput!.value).toBe("Broken");
  });
});
