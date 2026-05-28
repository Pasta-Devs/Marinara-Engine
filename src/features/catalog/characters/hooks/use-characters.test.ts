import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { cacheCharacterListRecordFromResult, characterKeys, removeCachedCharacterRecord } from "./use-characters";

function characterRecord(id: string, name: string) {
  return {
    id,
    data: { name, tags: [], extensions: {} },
    avatarPath: null,
    comment: null,
  };
}

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
