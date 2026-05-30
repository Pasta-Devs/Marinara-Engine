// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spriteApi } from "../../../../shared/api/image-generation-api";
import { spriteKeys } from "../query-keys";
import { useDeleteSprite, useSprites, useUploadSprite, useUploadSprites } from "./use-sprites";

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

  it("reads sprites through owner-neutral ids", async () => {
    listMock.mockResolvedValue([{ expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" }]);

    await renderHook(() => useSprites("persona-1"));
    await act(async () => {
      await queryClient.ensureQueryData({
        queryKey: spriteKeys.list("persona-1"),
        queryFn: () => spriteApi.list("persona-1"),
      });
    });

    expect(listMock).toHaveBeenCalledWith("persona-1");
  });

  it("does not query blank owner ids", async () => {
    await renderHook(() => useSprites("   "));

    expect(listMock).not.toHaveBeenCalled();
  });

  it("invalidates spriteOwnerId caches after single-sprite uploads", async () => {
    const uploadSprite = await renderHook(useUploadSprite);
    queryClient.setQueryData(spriteKeys.list("persona-1"), []);
    expect(queryClient.getQueryState(spriteKeys.list("persona-1"))?.isInvalidated).toBe(false);
    uploadMock.mockResolvedValue({ expression: "happy", filename: "happy.png", url: "asset://happy.png" });

    await act(async () => {
      await uploadSprite.mutateAsync({
        spriteOwnerId: "persona-1",
        expression: "happy",
        image: "data:image/png;base64,happy",
      });
    });

    expect(uploadMock).toHaveBeenCalledWith("persona-1", {
      expression: "happy",
      image: "data:image/png;base64,happy",
    });
    expect(queryClient.getQueryState(spriteKeys.list("persona-1"))?.isInvalidated).toBe(true);
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

    expect(uploadMock).toHaveBeenCalledWith("character-1", {
      expression: "happy",
      image: "data:image/png;base64,happy",
    });
  });

  it("rejects mutations without a usable owner id and leaves caches untouched", async () => {
    const uploadSprite = await renderHook(useUploadSprite);
    queryClient.setQueryData(spriteKeys.list("persona-1"), []);

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
    expect(queryClient.getQueryState(spriteKeys.list("persona-1"))?.isInvalidated).toBe(false);
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

    expect(bulkUploadMock).toHaveBeenCalledWith("character-1", {
      sprites: [{ expression: "neutral", image: "data:image/png;base64,neutral" }],
    });
    expect(queryClient.getQueryData(spriteKeys.list("character-1"))).toEqual([
      { expression: "neutral", filename: "neutral.png", url: "asset://neutral.png" },
    ]);

    await act(async () => {
      await deleteSprite.mutateAsync({ characterId: "character-1", expression: "neutral" });
    });

    expect(deleteMock).toHaveBeenCalledWith("character-1", "neutral");
    expect(queryClient.getQueryState(spriteKeys.list("character-1"))?.isInvalidated).toBe(true);
  });
});
