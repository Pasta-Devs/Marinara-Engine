// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateCharacterSchema } from "../../../../engine/contracts/schemas/character.schema";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  cacheCharacterListRecordFromResult,
  characterKeys,
  removeCachedCharacterRecord,
  useCharacters,
} from "./use-characters";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    list: vi.fn(),
  },
}));

const storageListMock = vi.mocked(storageApi.list);

function characterRecord(id: string, name: string) {
  return {
    id,
    data: { name, tags: [], extensions: {} },
    avatarPath: null,
    comment: null,
  };
}

function UseCharactersProbe() {
  useCharacters(true);
  return null;
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
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    storageListMock.mockReset();
  });

  it("projects full character list reads without embedded avatar payloads", async () => {
    await act(async () => {
      root.render(
        createElement(QueryClientProvider, {
          client: queryClient,
          children: createElement(UseCharactersProbe),
        }),
      );
    });

    await vi.waitFor(() => {
      expect(storageListMock).toHaveBeenCalledWith("characters", {
        fields: ["id", "data", "comment", "avatarFilePath", "avatarFilename", "createdAt", "updatedAt"],
      });
    });
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
