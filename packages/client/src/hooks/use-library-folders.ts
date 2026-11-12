import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  migrateLibraryFolderSchema,
  type LibraryFolderScope,
  type MigrateLibraryFolderInput,
} from "@marinara-engine/shared";
import { regexKeys } from "./use-regex-scripts";
import { api } from "../lib/api-client";

export type { LibraryFolderScope } from "@marinara-engine/shared";

export type LibraryFolder = {
  id: string;
  scope: LibraryFolderScope;
  name: string;
  collapsed: boolean;
  paused?: boolean;
  sortOrder: number;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "marinara-library-folders-v1";
const MAX_MIGRATION_FOLDERS = 1_000;

type LegacyLibraryFolder = MigrateLibraryFolderInput & {
  scope: LibraryFolderScope;
};

export const libraryFolderKeys = {
  all: ["library-folders"] as const,
  list: (scope: LibraryFolderScope) => [...libraryFolderKeys.all, scope] as const,
};

function readLegacyFolders(): LegacyLibraryFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((folder): LegacyLibraryFolder[] => {
      if (!folder || typeof folder !== "object" || !("scope" in folder)) return [];
      const { scope } = folder;
      if (scope !== "lorebooks" && scope !== "presets" && scope !== "agents") return [];
      const result = migrateLibraryFolderSchema.safeParse(folder);
      return result.success ? [{ ...result.data, scope }] : [];
    });
  } catch {
    return [];
  }
}

function writeLegacyFolders(folders: LegacyLibraryFolder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

function sortFolders(folders: LibraryFolder[]) {
  return [...folders].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

const migrationPromises = new Map<LibraryFolderScope, Promise<void>>();

function migrateLegacyFolders(scope: LibraryFolderScope) {
  const existingPromise = migrationPromises.get(scope);
  if (existingPromise) return existingPromise;

  const migrationPromise = (async () => {
    const allLegacyFolders = readLegacyFolders();
    const scopedFolders = allLegacyFolders.filter((folder) => folder.scope === scope);
    if (scopedFolders.length === 0) return;
    if (scopedFolders.length > MAX_MIGRATION_FOLDERS) {
      console.warn(
        `Skipping legacy ${scope} folder migration because it exceeds the ${MAX_MIGRATION_FOLDERS}-folder limit.`,
      );
      return;
    }

    await api.post(`/library-folders/${scope}/migrate`, {
      folders: scopedFolders.map(({ id, name, collapsed, sortOrder, itemIds }) => ({
        id,
        name,
        collapsed,
        sortOrder,
        itemIds,
      })),
    });
    try {
      const remainingFolders = readLegacyFolders().filter((folder) => folder.scope !== scope);
      writeLegacyFolders(remainingFolders);
    } catch (error) {
      console.warn("Legacy library folders migrated, but local cleanup failed.", error);
    }
  })().catch((error) => {
    migrationPromises.delete(scope);
    throw error;
  });

  migrationPromises.set(scope, migrationPromise);
  return migrationPromise;
}

export function getNextUnnamedLibraryFolderName(folders: Array<{ name: string }>) {
  const names = new Set(folders.map((folder) => folder.name.toLowerCase()));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index++;
  return `unnamed ${index}`;
}

export function useLibraryFolders(scope: LibraryFolderScope) {
  return useQuery({
    queryKey: libraryFolderKeys.list(scope),
    queryFn: async () => {
      await migrateLegacyFolders(scope);
      return sortFolders(await api.get<LibraryFolder[]>(`/library-folders/${scope}`));
    },
  });
}

export function useCreateLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      return api.post<LibraryFolder>(`/library-folders/${scope}`, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
  });
}

export function useUpdateLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      collapsed?: boolean;
      paused?: boolean;
      itemIds?: string[];
    }) => {
      return api.patch<LibraryFolder>(`/library-folders/${scope}/${id}`, data);
    },
    onSuccess: (_folder, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
        scope === "regex" &&
          (input.paused !== undefined || input.itemIds !== undefined) &&
          qc.invalidateQueries({ queryKey: regexKeys.all }),
      ]),
  });
}

export function useDeleteLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/library-folders/${scope}/${id}`);
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
        scope === "regex" && qc.invalidateQueries({ queryKey: regexKeys.all }),
      ]),
  });
}

export function useMoveLibraryItem(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      itemIds,
      folderId,
    }: {
      itemId?: string;
      itemIds?: string[];
      folderId: string | null;
    }) => {
      const ids = Array.from(new Set(itemIds ?? (itemId ? [itemId] : [])));
      if (ids.length === 0) return;
      await api.post(`/library-folders/${scope}/move`, { itemIds: ids, folderId });
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
        scope === "regex" && qc.invalidateQueries({ queryKey: regexKeys.all }),
      ]),
  });
}
