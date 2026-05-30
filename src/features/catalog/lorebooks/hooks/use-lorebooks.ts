// ──────────────────────────────────────────────
// React Query: Lorebook hooks
// ──────────────────────────────────────────────
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { lorebookKeys } from "../query-keys";
import { scanActiveLorebookEntries } from "../../../../engine/generation/active-lorebooks";
import {
  createLorebookEntrySchema,
  createLorebookFolderSchema,
  createLorebookSchema,
  updateLorebookEntrySchema,
  updateLorebookFolderSchema,
  updateLorebookSchema,
} from "../../../../engine/contracts/schemas/lorebook.schema";
import { storageApi } from "../../../../shared/api/storage-api";
import { ApiError } from "../../../../shared/api/api-errors";
import { lorebookCommandApi } from "../../../../shared/api/lorebook-command-api";
import type { Lorebook, LorebookEntry, LorebookFolder } from "../../../../engine/contracts/types/lorebook";
import { characterKeys } from "../../characters/query-keys";

export { lorebookKeys } from "../query-keys";

async function transferLorebookEntries(
  sourceLorebookId: string,
  targetLorebookId: string,
  entryIds: string[],
  operation: "copy" | "move",
): Promise<{
  operation: "copy" | "move";
  sourceLorebookId: string;
  targetLorebookId: string;
  requested: number;
  transferred: number;
  created: LorebookEntry[];
}> {
  const created: LorebookEntry[] = [];
  for (const entryId of entryIds) {
    const entry = await storageApi.get<LorebookEntry>("lorebook-entries", entryId);
    if (!entry || entry.lorebookId !== sourceLorebookId) continue;
    if (operation === "move") {
      created.push(
        await storageApi.update<LorebookEntry>(
          "lorebook-entries",
          entryId,
          updateLorebookEntrySchema.parse({ lorebookId: targetLorebookId }),
        ),
      );
    } else {
      const copy = { ...(entry as unknown as Record<string, unknown>) };
      delete copy.id;
      created.push(
        await storageApi.create<LorebookEntry>(
          "lorebook-entries",
          createLorebookEntrySchema.parse({
            ...copy,
            lorebookId: targetLorebookId,
          }),
        ),
      );
    }
  }
  return {
    operation,
    sourceLorebookId,
    targetLorebookId,
    requested: entryIds.length,
    transferred: created.length,
    created,
  };
}

async function reorderLorebookEntries(
  lorebookId: string,
  entryIds: string[],
  folderId?: string | null,
): Promise<LorebookEntry[]> {
  await Promise.all(
    entryIds.map((entryId, index) => {
      const patch: Record<string, unknown> = { order: index, sortOrder: index };
      if (folderId !== undefined) patch.folderId = folderId;
      return storageApi.update("lorebook-entries", entryId, updateLorebookEntrySchema.parse(patch));
    }),
  );
  return storageApi.list<LorebookEntry>("lorebook-entries", { filters: { lorebookId } });
}

async function reorderLorebookFolders(lorebookId: string, folderIds: string[]): Promise<LorebookFolder[]> {
  await Promise.all(
    folderIds.map((folderId, index) =>
      storageApi.update(
        "lorebook-folders",
        folderId,
        updateLorebookFolderSchema.parse({
          order: index,
          sortOrder: index,
        }),
      ),
    ),
  );
  return storageApi.list<LorebookFolder>("lorebook-folders", { filters: { lorebookId } });
}

async function bulkUnvectorizeLorebookEntries(
  lorebookId: string,
  entryIds?: string[],
): Promise<{ lorebookId: string; requested: number; cleared: number }> {
  const requestedIds = Array.from(new Set((entryIds ?? []).map((id) => id.trim()).filter(Boolean)));
  const entries =
    requestedIds.length > 0
      ? (
          await Promise.all(
            requestedIds.map((entryId) => storageApi.get<LorebookEntry>("lorebook-entries", entryId).catch(() => null)),
          )
        ).filter((entry): entry is LorebookEntry => !!entry && entry.lorebookId === lorebookId)
      : await storageApi.list<LorebookEntry>("lorebook-entries", { filters: { lorebookId } });
  const targets = entries.filter((entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0);
  await Promise.all(
    targets.map((entry) =>
      storageApi.update<LorebookEntry>(
        "lorebook-entries",
        entry.id,
        updateLorebookEntrySchema.parse({
          embedding: null,
        }),
      ),
    ),
  );
  return { lorebookId, requested: requestedIds.length || entries.length, cleared: targets.length };
}

// ── Lorebooks ──

export function useLorebooks(category?: string) {
  return useQuery({
    queryKey: category ? lorebookKeys.byCategory(category) : lorebookKeys.list(),
    queryFn: async () => {
      const lorebooks = await storageApi.list<Lorebook>("lorebooks");
      if (!category) return lorebooks;
      return lorebooks.filter((lorebook) => (lorebook.category ?? "uncategorized") === category);
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLorebook(id: string | null) {
  return useQuery({
    queryKey: lorebookKeys.detail(id ?? ""),
    queryFn: () =>
      storageApi.get<Lorebook>("lorebooks", id!).then((item) => {
        if (!item) throw new ApiError("Lorebook not found", 404);
        return item;
      }),
    enabled: !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  });
}

export function useCreateLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      storageApi.create<Lorebook>("lorebooks", createLorebookSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
    },
  });
}

export function useUpdateLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update<Lorebook>("lorebooks", id, updateLorebookSchema.parse(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      qc.invalidateQueries({ queryKey: lorebookKeys.list() });
      qc.invalidateQueries({ queryKey: lorebookKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useUploadLorebookImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image, filename }: { id: string; image: string; filename?: string }) =>
      lorebookCommandApi.uploadImage<Lorebook>(id, image, filename),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      qc.invalidateQueries({ queryKey: lorebookKeys.list() });
      qc.invalidateQueries({ queryKey: lorebookKeys.detail(variables.id) });
    },
  });
}

export function useDeleteLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("lorebooks", id),
    onSuccess: (_data, id) => {
      // Evict the deleted lorebook's detail + entries instead of just
      // marking them stale. `useLorebook`/`useLorebookEntries` set
      // staleTime to 5 minutes, and TanStack returns cached `data` even
      // after a refetch errors — so without explicit removal the next
      // "Edit Linked Lorebook" click would render a ghost editor with
      // the deleted lorebook's name and metadata while the entries
      // query reports 0 entries from native storage.
      qc.removeQueries({ queryKey: lorebookKeys.detail(id) });
      qc.removeQueries({ queryKey: lorebookKeys.entries(id) });
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      // Native storage clears `character_book` and the
      // `extensions.importMetadata.embeddedLorebook` pointer for any
      // character this lorebook was linked to. We do not know that
      // characterId client-side (the detail cache may already be gone
      // by this point), so blanket-invalidate character queries —
      // missing this lets the character editor keep rendering stale
      // entries and a broken "Edit Linked Lorebook" button.
      qc.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

// ── Entries ──

export function useLorebookEntries(lorebookId: string | null) {
  return useQuery({
    queryKey: lorebookKeys.entries(lorebookId ?? ""),
    queryFn: () => storageApi.list<LorebookEntry>("lorebook-entries", { filters: { lorebookId } }),
    enabled: !!lorebookId,
  });
}

/**
 * Fetch entries across multiple lorebooks in parallel. Each per-lorebook query
 * is cached independently, so repeated calls with overlapping IDs reuse cached
 * data. Returns the flattened entry array plus loading/error state — useful
 * for the Knowledge Router's description-coverage badge.
 *
 * Deduplicates IDs defensively before issuing queries — duplicates can't reach
 * this hook through the current UI, but a duplicate would otherwise register
 * the same query twice and inflate aggregate counts in the consumer.
 *
 * **`entries` is `undefined` until every query has succeeded.** That's a
 * deliberate API choice: returning a partial array on error would silently
 * mislead any consumer that forgot to check `isError`. The type system now
 * forces consumers to handle the unknown case.
 */
export function useEntriesAcrossLorebooks(lorebookIds: string[]): {
  entries: LorebookEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const uniqueIds = Array.from(new Set(lorebookIds));
  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: lorebookKeys.entries(id),
      queryFn: () => storageApi.list<LorebookEntry>("lorebook-entries", { filters: { lorebookId: id } }),
    })),
  });
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.isError)?.error ?? null;
  // Empty input is trivially "complete" — return [] so consumers can treat
  // "no selection" as a valid known state instead of an unresolved one.
  const allSucceeded = queries.length === 0 || queries.every((q) => q.isSuccess);
  const entries = allSucceeded ? queries.flatMap((q) => q.data ?? []) : undefined;
  return { entries, isLoading, isError, error };
}

export function useCreateLorebookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lorebookId, ...data }: { lorebookId: string } & Record<string, unknown>) =>
      storageApi.create<LorebookEntry>("lorebook-entries", createLorebookEntrySchema.parse({ ...data, lorebookId })),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useUpdateLorebookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lorebookId, entryId, ...data }: { lorebookId: string; entryId: string } & Record<string, unknown>) =>
      storageApi.update<LorebookEntry>("lorebook-entries", entryId, updateLorebookEntrySchema.parse(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.entry(variables.entryId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useDeleteLorebookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId }: { lorebookId: string; entryId: string }) =>
      storageApi.delete("lorebook-entries", entryId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useBulkUnvectorizeLorebookEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lorebookId, entryIds }: { lorebookId: string; entryIds?: string[] }) =>
      bulkUnvectorizeLorebookEntries(lorebookId, entryIds),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useTransferLorebookEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceLorebookId,
      targetLorebookId,
      entryIds,
      operation,
    }: {
      sourceLorebookId: string;
      targetLorebookId: string;
      entryIds: string[];
      operation: "copy" | "move";
    }) => transferLorebookEntries(sourceLorebookId, targetLorebookId, entryIds, operation),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.sourceLorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.targetLorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useReorderLorebookEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lorebookId,
      entryIds,
      folderId,
    }: {
      lorebookId: string;
      entryIds: string[];
      /**
       * Container scope for the reorder. `undefined` renumbers every entry
       * `null` reorders root-level entries only.
       * A string ID reorders the entries inside that folder only.
       */
      folderId?: string | null;
    }) => reorderLorebookEntries(lorebookId, entryIds, folderId),
    onSuccess: (entries, variables) => {
      qc.setQueryData(lorebookKeys.entries(variables.lorebookId), entries);
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

// ── Folders ──

export function useLorebookFolders(lorebookId: string | null) {
  return useQuery({
    queryKey: lorebookKeys.folders(lorebookId ?? ""),
    queryFn: () => storageApi.list<LorebookFolder>("lorebook-folders", { filters: { lorebookId } }),
    enabled: !!lorebookId,
  });
}

export function useCreateLorebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lorebookId, ...data }: { lorebookId: string } & Record<string, unknown>) =>
      storageApi.create<LorebookFolder>("lorebook-folders", createLorebookFolderSchema.parse({ ...data, lorebookId })),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.folders(variables.lorebookId) });
    },
  });
}

export function useUpdateLorebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lorebookId,
      folderId,
      ...data
    }: {
      lorebookId: string;
      folderId: string;
    } & Record<string, unknown>) =>
      storageApi.update<LorebookFolder>("lorebook-folders", folderId, updateLorebookFolderSchema.parse(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.folders(variables.lorebookId) });
      // Toggling folder.enabled changes which entries activate during scan
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useDeleteLorebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId }: { lorebookId: string; folderId: string }) =>
      storageApi.delete("lorebook-folders", folderId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: lorebookKeys.folders(variables.lorebookId) });
      // Removing a folder reparents its entries to root, so the entry list shape changes.
      qc.invalidateQueries({ queryKey: lorebookKeys.entries(variables.lorebookId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active() });
    },
  });
}

export function useReorderLorebookFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lorebookId, folderIds }: { lorebookId: string; folderIds: string[] }) =>
      reorderLorebookFolders(lorebookId, folderIds),
    onSuccess: (folders, variables) => {
      qc.setQueryData(lorebookKeys.folders(variables.lorebookId), folders);
      qc.invalidateQueries({ queryKey: lorebookKeys.folders(variables.lorebookId) });
    },
  });
}

interface ActiveLorebookEntry {
  id: string;
  name: string;
  content: string;
  keys: string[];
  lorebookId: string;
  order: number;
  constant: boolean;
}

export interface BudgetSkippedLorebookEntry {
  id: string;
  name: string;
  lorebookId: string;
  lorebookName: string;
  matchedKeys: string[];
  estimatedTokens: number;
  lorebookBudget: number;
  lorebookUsedTokens: number;
  chatBudget: number;
  chatUsedTokens: number;
  blockedBy: "lorebook" | "chat" | "both";
}

interface ActiveLorebookScan {
  entries: ActiveLorebookEntry[];
  budgetSkippedEntries: BudgetSkippedLorebookEntry[];
  totalTokens: number;
  totalEntries: number;
}

export function useActiveLorebookEntries(chatId: string | null, enabled = false) {
  return useQuery({
    queryKey: lorebookKeys.active(chatId),
    queryFn: () => scanActiveLorebookEntries(storageApi, chatId!) as Promise<ActiveLorebookScan>,
    enabled: !!chatId && enabled,
    staleTime: 30_000,
  });
}
