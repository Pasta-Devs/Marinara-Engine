// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageApi } from "../../../../shared/api/storage-api";
import { useCharacterVersions } from "./use-characters";

vi.mock("../../../../shared/api/character-api", () => ({
  characterApi: {
    removeAvatar: vi.fn(),
    restoreVersion: vi.fn(),
    update: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/image-generation-api", () => ({
  galleryApi: {
    uploadCharacter: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/local-file-api", () => ({
  resolveGalleryFileUrl: vi.fn(),
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-commands-api", () => ({
  storageCommandsApi: {
    duplicate: vi.fn(),
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function CharacterVersionsHarness({ characterId }: { characterId: string | null }) {
  useCharacterVersions(characterId);
  return null;
}

describe("useCharacterVersions", () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;
  let root: Root;

  beforeEach(() => {
    vi.mocked(storageApi.list).mockResolvedValue([]);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("requests character versions newest first", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CharacterVersionsHarness characterId="character-1" />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => expect(storageApi.list).toHaveBeenCalled());

    expect(storageApi.list).toHaveBeenCalledWith("character-versions", {
      filters: { characterId: "character-1" },
      orderBy: "createdAt",
      descending: true,
    });
  });

  it("waits for a character id before requesting versions", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CharacterVersionsHarness characterId={null} />
        </QueryClientProvider>,
      );
    });

    expect(storageApi.list).not.toHaveBeenCalled();
  });
});
