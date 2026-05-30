// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spriteApi } from "../../../../shared/api/image-generation-api";
import { spriteKeys } from "../query-keys";
import {
  useCleanupSavedSprites,
  useDeleteSprite,
  usePersonaSprites,
  useRestoreSpriteCleanupPoint,
  useSprites,
  useUploadSprite,
  useUploadSprites,
} from "./use-sprites";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/image-generation-api", () => ({
  spriteApi: {
    bulkUpload: vi.fn(),
    capabilities: vi.fn(),
    cleanupRestore: vi.fn(),
    cleanupSaved: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    upload: vi.fn(),
  },
}));

const listMock = vi.mocked(spriteApi.list);
const uploadMock = vi.mocked(spriteApi.upload);
const bulkUploadMock = vi.mocked(spriteApi.bulkUpload);
const deleteMock = vi.mocked(spriteApi.delete);
const cleanupSavedMock = vi.mocked(spriteApi.cleanupSaved);
const cleanupRestoreMock = vi.mocked(spriteApi.cleanupRestore);

describe("shared sprite hooks", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    listMock.mockReset();
    uploadMock.mockReset();
    bulkUploadMock.mockReset();
    deleteMock.mockReset();
    cleanupSavedMock.mockReset();
    cleanupRestoreMock.mockReset();
  });

  async function renderHook<TValue>(useHook: () => TValue): Promise<TValue> {
    let value: TValue | undefined;

    function Probe() {
      value = useHook();
      return null;
    }

    await act(async () => {
      root.render(
        createElement(QueryClientProvider, {
          client: queryClient,
          children: createElement(Probe),
        }),
      );
    });

    if (!value) {
      throw new Error("Hook did not render");
    }

    return value;
  }

  it("reads character sprites by default", async () => {
    listMock.mockResolvedValue([{ expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" }]);

    await renderHook(() => useSprites("character-1"));
    await act(async () => {
      await queryClient.ensureQueryData({
        queryKey: spriteKeys.list("character-1"),
        queryFn: () => spriteApi.list("character-1", { ownerType: "character" }),
      });
    });

    expect(listMock).toHaveBeenCalledWith("character-1", { ownerType: "character" });
  });

  it("reads persona sprites with a persona owner namespace", async () => {
    listMock.mockResolvedValue([{ expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" }]);

    await renderHook(() => usePersonaSprites("persona-1"));
    await act(async () => {
      await queryClient.ensureQueryData({
        queryKey: spriteKeys.list("persona-1", "persona"),
        queryFn: () => spriteApi.list("persona-1", { ownerType: "persona" }),
      });
    });

    expect(listMock).toHaveBeenCalledWith("persona-1", { ownerType: "persona" });
  });

  it("does not query blank owner ids", async () => {
    await renderHook(() => useSprites("   "));

    expect(listMock).not.toHaveBeenCalled();
  });

  it("invalidates spriteOwnerId caches after single-sprite uploads", async () => {
    const uploadSprite = await renderHook(useUploadSprite);
    queryClient.setQueryData(spriteKeys.list("persona-1", "persona"), []);
    expect(queryClient.getQueryState(spriteKeys.list("persona-1", "persona"))?.isInvalidated).toBe(false);
    uploadMock.mockResolvedValue({ expression: "happy", filename: "happy.png", url: "asset://happy.png" });

    await act(async () => {
      await uploadSprite.mutateAsync({
        spriteOwnerId: "persona-1",
        ownerType: "persona",
        expression: "happy",
        image: "data:image/png;base64,happy",
      });
    });

    expect(uploadMock).toHaveBeenCalledWith(
      "persona-1",
      {
        expression: "happy",
        image: "data:image/png;base64,happy",
      },
      { ownerType: "persona" },
    );
    expect(queryClient.getQueryState(spriteKeys.list("persona-1", "persona"))?.isInvalidated).toBe(true);
  });

  it("falls back from blank spriteOwnerId to legacy characterId", async () => {
    const uploadSprite = await renderHook(useUploadSprite);
    uploadMock.mockResolvedValue({ expression: "happy", filename: "happy.png", url: "asset://happy.png" });

    await act(async () => {
      await uploadSprite.mutateAsync({
        spriteOwnerId: "  ",
        characterId: "character-1",
        expression: "happy",
        image: "data:image/png;base64,happy",
      });
    });

    expect(uploadMock).toHaveBeenCalledWith(
      "character-1",
      {
        expression: "happy",
        image: "data:image/png;base64,happy",
      },
      { ownerType: "character" },
    );
  });

  it("rejects mutations without a usable owner id and leaves caches untouched", async () => {
    const uploadSprite = await renderHook(useUploadSprite);
    queryClient.setQueryData(spriteKeys.list("persona-1", "persona"), []);

    await act(async () => {
      await expect(
        uploadSprite.mutateAsync({
          spriteOwnerId: " ",
          expression: "happy",
          image: "data:image/png;base64,happy",
        }),
      ).rejects.toThrow("Sprite owner id is required.");
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(spriteKeys.list("persona-1", "persona"))?.isInvalidated).toBe(false);
  });

  it("preserves legacy characterId mutation compatibility", async () => {
    const uploadSprites = await renderHook(useUploadSprites);
    const deleteSprite = await renderHook(useDeleteSprite);
    queryClient.setQueryData(spriteKeys.list("character-1"), []);
    bulkUploadMock.mockResolvedValue({
      imported: 1,
      failed: [],
      sprites: [{ expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" }],
    });
    deleteMock.mockResolvedValue({ deleted: true });

    await act(async () => {
      await uploadSprites.mutateAsync({
        characterId: "character-1",
        sprites: [{ expression: "neutral", image: "data:image/png;base64,neutral" }],
      });
    });

    expect(bulkUploadMock).toHaveBeenCalledWith(
      "character-1",
      {
        sprites: [{ expression: "neutral", image: "data:image/png;base64,neutral" }],
      },
      { ownerType: "character" },
    );
    expect(queryClient.getQueryData(spriteKeys.list("character-1"))).toEqual([
      { expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" },
    ]);

    await act(async () => {
      await deleteSprite.mutateAsync({ characterId: "character-1", expression: "neutral" });
    });

    expect(deleteMock).toHaveBeenCalledWith("character-1", "neutral", { ownerType: "character" });
    expect(queryClient.getQueryState(spriteKeys.list("character-1"))?.isInvalidated).toBe(true);
  });

  it("cleans saved sprites through owner-neutral ids and invalidates that owner cache", async () => {
    const cleanupSavedSprites = await renderHook(useCleanupSavedSprites);
    queryClient.setQueryData(spriteKeys.list("persona-1", "persona"), []);
    cleanupSavedMock.mockResolvedValue({
      processed: 1,
      failed: [],
      sprites: [{ expression: "happy", filename: "happy.png", url: "asset://happy.png" }],
    });

    await act(async () => {
      await cleanupSavedSprites.mutateAsync({
        spriteOwnerId: "persona-1",
        ownerType: "persona",
        expressions: ["happy"],
      });
    });

    expect(cleanupSavedMock).toHaveBeenCalledWith(
      "persona-1",
      {
        expressions: ["happy"],
        cleanupStrength: 35,
        engine: "auto",
      },
      { ownerType: "persona" },
    );
    expect(queryClient.getQueryState(spriteKeys.list("persona-1", "persona"))?.isInvalidated).toBe(true);
  });

  it("restores sprite cleanup points through owner-neutral ids and invalidates that owner cache", async () => {
    const restoreSpriteCleanupPoint = await renderHook(useRestoreSpriteCleanupPoint);
    queryClient.setQueryData(spriteKeys.list("persona-1", "persona"), []);
    cleanupRestoreMock.mockResolvedValue({
      restored: 1,
      failed: [],
      sprites: [{ expression: "happy", filename: "happy.png", url: "asset://happy.png" }],
    });

    await act(async () => {
      await restoreSpriteCleanupPoint.mutateAsync({
        spriteOwnerId: "persona-1",
        ownerType: "persona",
        restorePointId: "restore-1",
      });
    });

    expect(cleanupRestoreMock).toHaveBeenCalledWith(
      "persona-1",
      {
        restorePointId: "restore-1",
      },
      { ownerType: "persona" },
    );
    expect(queryClient.getQueryState(spriteKeys.list("persona-1", "persona"))?.isInvalidated).toBe(true);
  });
});
