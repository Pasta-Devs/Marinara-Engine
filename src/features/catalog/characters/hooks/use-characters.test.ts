// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateCharacterSchema } from "../../../../engine/contracts/schemas/character.schema";
import { remoteRuntimeTarget } from "../../../../shared/api/remote-runtime";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  cacheCharacterListRecordFromResult,
  characterKeys,
  removeCachedCharacterRecord,
  useCharacter,
  useCharacterSummaries,
  useCharactersByIds,
  useCharacters,
} from "./use-characters";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    get: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("../../../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
  isRemoteCommand: vi.fn(),
  remoteRuntimeTarget: vi.fn(),
}));

const convertFileSrcMock = vi.mocked(convertFileSrc);
const remoteRuntimeTargetMock = vi.mocked(remoteRuntimeTarget);
const storageGetMock = vi.mocked(storageApi.get);
const storageListMock = vi.mocked(storageApi.list);

function characterRecord(id: string, name: string) {
  return {
    id,
    data: { name, tags: [], extensions: {} },
    avatarPath: null,
    comment: null,
  };
}

describe("character list query", () => {
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
    storageListMock.mockResolvedValue([]);
    storageGetMock.mockResolvedValue(null);
    remoteRuntimeTargetMock.mockReturnValue(null);
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    storageGetMock.mockReset();
    storageListMock.mockReset();
    convertFileSrcMock.mockReset();
    remoteRuntimeTargetMock.mockReset();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  async function renderHook<THook>(useHook: () => THook): Promise<() => THook> {
    let hook: THook | undefined;

    function Probe() {
      hook = useHook();
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

    if (!hook) {
      throw new Error("Hook did not render");
    }

    return () => {
      if (!hook) {
        throw new Error("Hook did not render");
      }
      return hook;
    };
  }

  it("requests list fields needed for managed and legacy avatar paths", async () => {
    await renderHook(() => useCharacters(true));

    await vi.waitFor(() => {
      expect(storageListMock).toHaveBeenCalledWith("characters", {
        fields: ["id", "data", "comment", "avatarPath", "avatarFilePath", "avatarFilename", "createdAt", "updatedAt"],
      });
    });
  });

  it("normalizes managed avatar paths from character summaries", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "char-1",
        data: { name: "Managed Character" },
        avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
        avatarFilename: "Managed.png",
      },
    ]);

    const getSummaries = await renderHook(useCharacterSummaries);

    await vi.waitFor(() =>
      expect(getSummaries().data).toEqual([
        {
          id: "char-1",
          data: { name: "Managed Character" },
          avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CManaged.png",
          avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
          avatarFilename: "Managed.png",
        },
      ]),
    );
  });

  it("normalizes managed avatar paths from full character list reads", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "char-1",
        data: { name: "Managed Character" },
        avatarPath: "data:image/png;base64,large-avatar",
        avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
        avatarFilename: "Managed.png",
      },
    ]);

    const getCharacters = await renderHook(() => useCharacters(true));

    await vi.waitFor(() =>
      expect(getCharacters().data).toEqual([
        {
          id: "char-1",
          data: { name: "Managed Character" },
          avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CManaged.png",
          avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
          avatarFilename: "Managed.png",
        },
      ]),
    );
  });

  it("normalizes managed avatar paths to remote runtime asset urls", async () => {
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://runtime.local" });
    storageListMock.mockResolvedValue([
      {
        id: "char-1",
        data: { name: "Managed Character" },
        avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed Avatar.png",
        avatarFilename: "Managed Avatar.png",
      },
    ]);

    const getCharacters = await renderHook(() => useCharacters(true));

    await vi.waitFor(() =>
      expect(getCharacters().data).toEqual([
        {
          id: "char-1",
          data: { name: "Managed Character" },
          avatarPath: "http://runtime.local/api/assets/avatar/Managed%20Avatar.png",
          avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed Avatar.png",
          avatarFilename: "Managed Avatar.png",
        },
      ]),
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("preserves legacy avatar paths from full character list reads", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "char-1",
        data: { name: "Legacy Character" },
        avatarPath: "data:image/png;base64,legacy-avatar",
      },
    ]);

    const getCharacters = await renderHook(() => useCharacters(true));

    await vi.waitFor(() =>
      expect(getCharacters().data).toEqual([
        {
          id: "char-1",
          data: { name: "Legacy Character" },
          avatarPath: "data:image/png;base64,legacy-avatar",
        },
      ]),
    );
  });

  it("normalizes missing avatar paths to null from full character list reads", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "char-1",
        data: { name: "No Avatar Character" },
      },
    ]);

    const getCharacters = await renderHook(() => useCharacters(true));

    await vi.waitFor(() =>
      expect(getCharacters().data).toEqual([
        {
          id: "char-1",
          data: { name: "No Avatar Character" },
          avatarPath: null,
        },
      ]),
    );
  });

  it("normalizes managed avatar paths from character detail reads", async () => {
    storageGetMock.mockResolvedValue({
      id: "char-1",
      data: { name: "Managed Character" },
      avatarPath: "data:image/png;base64,large-avatar",
      avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
      avatarFilename: "Managed.png",
    });

    const getCharacter = await renderHook(() => useCharacter("char-1"));

    await vi.waitFor(() =>
      expect(getCharacter().data).toEqual({
        id: "char-1",
        data: { name: "Managed Character" },
        avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CManaged.png",
        avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
        avatarFilename: "Managed.png",
      }),
    );
  });

  it("normalizes managed avatar paths from character reads by id", async () => {
    storageGetMock.mockResolvedValue({
      id: "char-1",
      data: { name: "Managed Character" },
      avatarPath: "data:image/png;base64,large-avatar",
      avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
      avatarFilename: "Managed.png",
    });

    const getCharacters = await renderHook(() => useCharactersByIds(["char-1"]));

    await vi.waitFor(() =>
      expect(getCharacters().data).toEqual([
        {
          id: "char-1",
          data: { name: "Managed Character" },
          avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CManaged.png",
          avatarFilePath: "C:\\Marinara\\avatars\\characters\\Managed.png",
          avatarFilename: "Managed.png",
        },
      ]),
    );
  });
});

describe("character query cache helpers", () => {
  it("updates character list and summary caches from a created or imported character result", () => {
    const queryClient = new QueryClient();
    const existing = characterRecord("char-existing", "Existing Character");
    const created = characterRecord("char-created", "Created Character");

    queryClient.setQueryData(characterKeys.list(), [existing]);
    queryClient.setQueryData(characterKeys.summaries(), [existing]);

    expect(cacheCharacterListRecordFromResult(queryClient, { character: created })).toBe(true);

    expect(queryClient.getQueryData(characterKeys.list())).toEqual([created, existing]);
    expect(queryClient.getQueryData(characterKeys.summaries())).toEqual([created, existing]);
    expect(queryClient.getQueryData(characterKeys.detail(created.id))).toEqual(created);
    expect(queryClient.getQueryData(characterKeys.summaryDetail(created.id))).toEqual(created);
  });

  it("normalizes managed avatar paths in character cache writes", () => {
    const queryClient = new QueryClient();
    remoteRuntimeTargetMock.mockReturnValue(null);
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
    const created = {
      id: "char-created",
      data: { name: "Created Character" },
      avatarPath: "data:image/png;base64,large-avatar",
      avatarFilePath: "C:\\Marinara\\avatars\\characters\\Created.png",
      avatarFilename: "Created.png",
      comment: null,
    };
    const expected = {
      ...created,
      avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CCreated.png",
    };

    queryClient.setQueryData(characterKeys.list(), []);
    queryClient.setQueryData(characterKeys.summaries(), []);

    expect(cacheCharacterListRecordFromResult(queryClient, { character: created })).toBe(true);

    expect(queryClient.getQueryData(characterKeys.list())).toEqual([expected]);
    expect(queryClient.getQueryData(characterKeys.summaries())).toEqual([expected]);
    expect(queryClient.getQueryData(characterKeys.detail(created.id))).toEqual(expected);
    expect(queryClient.getQueryData(characterKeys.summaryDetail(created.id))).toEqual(expected);
  });

  it("removes deleted characters from list and summary caches", () => {
    const queryClient = new QueryClient();
    const deleted = characterRecord("char-deleted", "Deleted Character");
    const kept = characterRecord("char-kept", "Kept Character");

    queryClient.setQueryData(characterKeys.list(), [deleted, kept]);
    queryClient.setQueryData(characterKeys.summaries(), [deleted, kept]);
    queryClient.setQueryData(characterKeys.detail(deleted.id), deleted);
    queryClient.setQueryData(characterKeys.summaryDetail(deleted.id), deleted);

    removeCachedCharacterRecord(queryClient, deleted.id);

    expect(queryClient.getQueryData(characterKeys.list())).toEqual([kept]);
    expect(queryClient.getQueryData(characterKeys.summaries())).toEqual([kept]);
    expect(queryClient.getQueryData(characterKeys.detail(deleted.id))).toBeUndefined();
    expect(queryClient.getQueryData(characterKeys.summaryDetail(deleted.id))).toBeUndefined();
  });

  it("removes deleted character detail caches even when collection caches are absent", () => {
    const queryClient = new QueryClient();
    const deleted = characterRecord("char-deleted", "Deleted Character");

    queryClient.setQueryData(characterKeys.detail(deleted.id), deleted);
    queryClient.setQueryData(characterKeys.summaryDetail(deleted.id), deleted);

    removeCachedCharacterRecord(queryClient, deleted.id);

    expect(queryClient.getQueryData(characterKeys.detail(deleted.id))).toBeUndefined();
    expect(queryClient.getQueryData(characterKeys.summaryDetail(deleted.id))).toBeUndefined();
  });
});

describe("character update schema", () => {
  it("does not default-fill embedded character book fields during partial updates", () => {
    const parsed = updateCharacterSchema.parse({
      data: {
        character_book: {
          entries: [
            {
              keys: ["moon"],
              vendor_entry_field: { source: "legacy-card" },
            },
          ],
        },
      },
    });

    const book = parsed.data?.character_book as Record<string, unknown> | null | undefined;
    const entry = Array.isArray(book?.entries) ? (book.entries[0] as Record<string, unknown>) : null;
    expect(book).not.toHaveProperty("name");
    expect(book).not.toHaveProperty("token_budget");
    expect(book).not.toHaveProperty("recursive_scanning");
    expect(entry).not.toHaveProperty("content");
    expect(entry).not.toHaveProperty("enabled");
    expect(entry?.vendor_entry_field).toEqual({ source: "legacy-card" });
  });

  it("preserves unknown embedded character book fields when parsing update imports", () => {
    const parsed = updateCharacterSchema.parse({
      data: {
        character_book: {
          name: "Imported book",
          vendor_book_field: "keep me",
          entries: [
            {
              keys: ["moon"],
              content: "The moon key opens the silver gate.",
              vendor_entry_field: { source: "legacy-card" },
            },
          ],
        },
      },
    });

    const book = parsed.data?.character_book as Record<string, unknown> | null | undefined;
    const entry = Array.isArray(book?.entries) ? (book.entries[0] as Record<string, unknown>) : null;
    expect(book?.vendor_book_field).toBe("keep me");
    expect(entry?.vendor_entry_field).toEqual({ source: "legacy-card" });
  });
});
