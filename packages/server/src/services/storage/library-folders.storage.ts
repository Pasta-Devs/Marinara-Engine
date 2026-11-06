// ──────────────────────────────────────────────
// Storage: Resource Library Folders
// ──────────────────────────────────────────────
import type {
  CreateLibraryFolderInput,
  LibraryFolderScope,
  MigrateLibraryFoldersInput,
  MoveLibraryItemsInput,
  UpdateLibraryFolderInput,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { libraryFolders, lorebooks, promptPresets } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

type LibraryFolderRow = typeof libraryFolders.$inferSelect;

function parseItemIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function mapFolder(row: LibraryFolderRow) {
  return {
    id: row.id,
    scope: row.scope as LibraryFolderScope,
    name: row.name,
    collapsed: row.collapsed === "true",
    sortOrder: row.sortOrder,
    itemIds: parseItemIds(row.itemIds),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createLibraryFoldersStorage(db: DB) {
  const listRows = (scope: LibraryFolderScope) =>
    db.select().from(libraryFolders).where(eq(libraryFolders.scope, scope)).orderBy(libraryFolders.sortOrder);

  return {
    async list(scope: LibraryFolderScope) {
      return (await listRows(scope)).map(mapFolder);
    },

    async getById(scope: LibraryFolderScope, id: string) {
      const rows = await db.select().from(libraryFolders).where(eq(libraryFolders.id, id));
      const row = rows.find((candidate) => candidate.scope === scope);
      return row ? mapFolder(row) : null;
    },

    async create(scope: LibraryFolderScope, input: CreateLibraryFolderInput) {
      const id = newId();
      const timestamp = now();
      const existing = await listRows(scope);
      const nextSortOrder = existing.reduce((maximum, folder) => Math.max(maximum, folder.sortOrder), -1) + 1;
      await db.insert(libraryFolders).values({
        id,
        scope,
        name: input.name,
        collapsed: "false",
        sortOrder: nextSortOrder,
        itemIds: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(scope, id);
    },

    async update(scope: LibraryFolderScope, id: string, input: UpdateLibraryFolderInput) {
      const existing = await this.getById(scope, id);
      if (!existing) return null;
      await db
        .update(libraryFolders)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.collapsed !== undefined && { collapsed: input.collapsed ? "true" : "false" }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.itemIds !== undefined && { itemIds: JSON.stringify(input.itemIds) }),
          updatedAt: now(),
        })
        .where(eq(libraryFolders.id, id));
      return this.getById(scope, id);
    },

    async remove(scope: LibraryFolderScope, id: string) {
      const existing = await this.getById(scope, id);
      if (!existing) return false;
      await db.delete(libraryFolders).where(eq(libraryFolders.id, id));
      return true;
    },

    async removeItemReferences(scope: LibraryFolderScope, itemIds: string[]) {
      const removingIds = new Set(itemIds);
      if (removingIds.size === 0) return 0;

      const rows = await db.select().from(libraryFolders).where(eq(libraryFolders.scope, scope));

      const timestamp = now();
      let removedCount = 0;

      for (const folder of rows) {
        const currentIds = parseItemIds(folder.itemIds);
        const nextIds = currentIds.filter((id) => !removingIds.has(id));

        if (nextIds.length === currentIds.length) continue;

        removedCount += currentIds.length - nextIds.length;

        await db
          .update(libraryFolders)
          .set({
            itemIds: JSON.stringify(nextIds),
            updatedAt: timestamp,
          })
          .where(eq(libraryFolders.id, folder.id));
      }

      return removedCount;
    },

    async moveItems(scope: LibraryFolderScope, input: MoveLibraryItemsInput) {
      const movingIds = new Set(input.itemIds);
      const timestamp = now();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(libraryFolders)
          .where(eq(libraryFolders.scope, scope))
          .orderBy(libraryFolders.sortOrder);
        if (input.folderId !== null && !rows.some((folder) => folder.id === input.folderId)) return false;

        for (const folder of rows) {
          const currentIds = parseItemIds(folder.itemIds);
          const nextIds = currentIds.filter((id) => !movingIds.has(id));
          if (folder.id === input.folderId) nextIds.push(...input.itemIds);
          if (folder.id !== input.folderId && nextIds.length === currentIds.length) continue;
          await tx
            .update(libraryFolders)
            .set({ itemIds: JSON.stringify(nextIds), updatedAt: timestamp })
            .where(eq(libraryFolders.id, folder.id));
        }
        return true;
      });
    },

    async pruneMissingLorebookItemIds() {
      return db.transaction(async (tx) => {
        const existingIds = new Set((await tx.select({ id: lorebooks.id }).from(lorebooks)).map((book) => book.id));
        const folders = await tx
          .select({ itemIds: libraryFolders.itemIds })
          .from(libraryFolders)
          .where(eq(libraryFolders.scope, "lorebooks"));
        const missingIds = new Set<string>();
        for (const folder of folders) {
          for (const id of parseItemIds(folder.itemIds)) {
            if (!existingIds.has(id)) missingIds.add(id);
          }
        }
        if (missingIds.size === 0) return 0;

        await createLibraryFoldersStorage(tx).removeItemReferences("lorebooks", [...missingIds]);

        return missingIds.size;
      });
    },

    async pruneMissingPresetItemIds() {
      return db.transaction(async (tx) => {
        const existingIds = new Set(
          (await tx.select({ id: promptPresets.id }).from(promptPresets)).map((preset) => preset.id),
        );
        const folders = await tx
          .select({ itemIds: libraryFolders.itemIds })
          .from(libraryFolders)
          .where(eq(libraryFolders.scope, "presets"));
        const missingIds = new Set<string>();
        for (const folder of folders) {
          for (const id of parseItemIds(folder.itemIds)) {
            if (!existingIds.has(id)) missingIds.add(id);
          }
        }
        if (missingIds.size === 0) return 0;

        await createLibraryFoldersStorage(tx).removeItemReferences("presets", [...missingIds]);

        return missingIds.size;
      });
    },

    async migrate(scope: LibraryFolderScope, input: MigrateLibraryFoldersInput) {
      const existing = await listRows(scope);
      if (existing.length > 0 || input.folders.length === 0) {
        return { imported: false, folders: existing.map(mapFolder) };
      }

      const timestamp = now();
      await db.transaction(async (tx) => {
        for (const folder of input.folders) {
          await tx.insert(libraryFolders).values({
            id: folder.id,
            scope,
            name: folder.name,
            collapsed: folder.collapsed ? "true" : "false",
            sortOrder: folder.sortOrder,
            itemIds: JSON.stringify(folder.itemIds),
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      });
      return { imported: true, folders: (await listRows(scope)).map(mapFolder) };
    },
  };
}
