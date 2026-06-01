import type { QueryClient } from "@tanstack/react-query";
import { characterKeys } from "../query-keys";
import { characterAvatarUrl, type CharacterAvatarSource } from "./character-avatar-url";

type CharacterListRecord = Record<string, unknown> & { id?: string };

function isCharacterListRecord(value: unknown): value is CharacterListRecord & { id: string } {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCharacterAvatarFields<T>(character: T): T {
  if (!isRecord(character)) return character;
  const avatarPath = characterAvatarUrl(character as CharacterAvatarSource);
  const hasAvatarPath = Object.prototype.hasOwnProperty.call(character, "avatarPath");
  const currentAvatarPath = character.avatarPath as string | null | undefined;
  if (hasAvatarPath && currentAvatarPath === avatarPath) return character;
  return { ...character, avatarPath } as T;
}

function upsertCharacterListRecord(current: unknown[] | undefined, record: unknown): unknown[] | undefined {
  if (!isCharacterListRecord(record)) return current;
  if (!Array.isArray(current)) return current;

  const existingIndex = current.findIndex((item) => isCharacterListRecord(item) && item.id === record.id);
  if (existingIndex === -1) return [record, ...current];

  return current.map((item, index) =>
    index === existingIndex && isCharacterListRecord(item) ? { ...item, ...record } : item,
  );
}

function removeCharacterListRecord(current: unknown[] | undefined, id: string): unknown[] | undefined {
  if (!Array.isArray(current)) return current;
  return current.filter((item) => !isCharacterListRecord(item) || item.id !== id);
}

export function invalidateCharacterCollectionQueries(queryClient: Pick<QueryClient, "invalidateQueries">): void {
  queryClient.invalidateQueries({ queryKey: characterKeys.list() });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

function upsertCharacterCollectionRecord(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData">,
  queryKey: readonly unknown[],
  record: CharacterListRecord & { id: string },
): boolean {
  const current = queryClient.getQueryData<unknown[] | undefined>(queryKey);
  if (!Array.isArray(current)) return false;
  queryClient.setQueryData<unknown[] | undefined>(queryKey, (value) => upsertCharacterListRecord(value, record));
  return true;
}

function removeCharacterCollectionRecord(
  queryClient: Pick<QueryClient, "setQueryData">,
  queryKey: readonly unknown[],
  id: string,
): void {
  queryClient.setQueryData<unknown[] | undefined>(queryKey, (value) => removeCharacterListRecord(value, id));
}

export function cacheCharacterListRecordFromResult(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData">,
  result: unknown,
): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const record = normalizeCharacterAvatarFields((result as { character?: unknown }).character);
  if (!isCharacterListRecord(record)) return false;

  const updatedList = upsertCharacterCollectionRecord(queryClient, characterKeys.list(), record);
  const updatedSummaries = upsertCharacterCollectionRecord(queryClient, characterKeys.summaries(), record);
  queryClient.setQueryData(characterKeys.detail(record.id), record);
  queryClient.setQueryData(characterKeys.summaryDetail(record.id), record);
  return updatedList || updatedSummaries;
}

export function removeCachedCharacterRecord(
  queryClient: Pick<QueryClient, "setQueryData" | "removeQueries" | "invalidateQueries">,
  id: string,
) {
  removeCharacterCollectionRecord(queryClient, characterKeys.list(), id);
  removeCharacterCollectionRecord(queryClient, characterKeys.summaries(), id);
  queryClient.removeQueries({ queryKey: characterKeys.detail(id) });
  queryClient.removeQueries({ queryKey: characterKeys.summaryDetail(id) });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

export function refreshCharacterCollectionAfterMutation(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData" | "invalidateQueries">,
  result: unknown,
): void {
  const updated = cacheCharacterListRecordFromResult(queryClient, { character: result });
  if (!updated) invalidateCharacterCollectionQueries(queryClient);
  else queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

function invalidateCharacterDetailQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  id: string,
  options: { includeVersions?: boolean } = {},
): void {
  queryClient.invalidateQueries({ queryKey: characterKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaryDetail(id) });
  if (options.includeVersions) {
    queryClient.invalidateQueries({ queryKey: characterKeys.versions(id) });
  }
}

export function invalidateCharacterRecordQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  id: string,
  options: { includeVersions?: boolean } = {},
): void {
  invalidateCharacterCollectionQueries(queryClient);
  invalidateCharacterDetailQueries(queryClient, id, options);
}
