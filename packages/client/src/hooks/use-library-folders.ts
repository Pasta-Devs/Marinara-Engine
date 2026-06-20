import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LibraryFolderScope = "lorebooks" | "presets" | "agents";

export type LibraryFolder = {
  id: string;
  scope: LibraryFolderScope;
  name: string;
  collapsed: boolean;
  sortOrder: number;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "marinara-library-folders-v1";

export const libraryFolderKeys = {
  all: ["library-folders"] as const,
  list: (scope: LibraryFolderScope) => [...libraryFolderKeys.all, scope] as const,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readFolders(): LibraryFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (folder): folder is LibraryFolder =>
        folder &&
        typeof folder === "object" &&
        (folder.scope === "lorebooks" || folder.scope === "presets" || folder.scope === "agents") &&
        typeof folder.id === "string" &&
        typeof folder.name === "string" &&
        Array.isArray(folder.itemIds),
    );
  } catch {
    return [];
  }
}

function writeFolders(folders: LibraryFolder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

function sortFolders(folders: LibraryFolder[]) {
  return [...folders].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
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
    queryFn: () => sortFolders(readFolders().filter((folder) => folder.scope === scope)),
  });
}

export function useCreateLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const now = new Date().toISOString();
      const folders = readFolders();
      const scopedFolders = folders.filter((folder) => folder.scope === scope);
      const folder: LibraryFolder = {
        id: createId(),
        scope,
        name: data.name,
        collapsed: false,
        sortOrder: scopedFolders.length,
        itemIds: [],
        createdAt: now,
        updatedAt: now,
      };
      writeFolders([...folders, folder]);
      return folder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
  });
}

export function useUpdateLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; collapsed?: boolean; itemIds?: string[] }) => {
      const now = new Date().toISOString();
      const folders = readFolders().map((folder) =>
        folder.scope === scope && folder.id === id ? { ...folder, ...data, updatedAt: now } : folder,
      );
      writeFolders(folders);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
  });
}

export function useDeleteLibraryFolder(scope: LibraryFolderScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      writeFolders(readFolders().filter((folder) => !(folder.scope === scope && folder.id === id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
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
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const folders = readFolders().map((folder) => {
        if (folder.scope !== scope) return folder;
        const nextItemIds = folder.itemIds.filter((id) => !idSet.has(id));
        if (folder.id === folderId) {
          nextItemIds.push(...ids.filter((id) => !nextItemIds.includes(id)));
        }
        return { ...folder, itemIds: nextItemIds, updatedAt: now };
      });
      writeFolders(folders);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryFolderKeys.list(scope) }),
  });
}
