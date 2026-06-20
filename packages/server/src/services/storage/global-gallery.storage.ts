// ──────────────────────────────────────────────
// Storage: Global Gallery Images & Folders
// ──────────────────────────────────────────────
import { eq, desc, isNull } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { globalImages, galleryFolders } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreateGlobalImageInput {
  filePath: string;
  folderId?: string | null;
  prompt?: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
}

export function createGlobalGalleryStorage(db: DB) {
  return {
    // ── Images ──

    /** List images. Omit `folderId` for all images; pass `null` for unfiled (root). */
    async listImages(folderId?: string | null) {
      if (folderId === undefined) {
        return db.select().from(globalImages).orderBy(desc(globalImages.createdAt));
      }
      const condition = folderId === null ? isNull(globalImages.folderId) : eq(globalImages.folderId, folderId);
      return db.select().from(globalImages).where(condition).orderBy(desc(globalImages.createdAt));
    },

    async getImageById(id: string) {
      const rows = await db.select().from(globalImages).where(eq(globalImages.id, id));
      return rows[0] ?? null;
    },

    async createImage(input: CreateGlobalImageInput) {
      const id = newId();
      await db.insert(globalImages).values({
        id,
        folderId: input.folderId ?? null,
        filePath: input.filePath,
        prompt: input.prompt ?? "",
        provider: input.provider ?? "",
        model: input.model ?? "",
        width: input.width ?? null,
        height: input.height ?? null,
        createdAt: now(),
      });
      return this.getImageById(id);
    },

    async moveImage(id: string, folderId: string | null) {
      await db.update(globalImages).set({ folderId }).where(eq(globalImages.id, id));
      return this.getImageById(id);
    },

    async removeImage(id: string) {
      await db.delete(globalImages).where(eq(globalImages.id, id));
    },

    async setTag(
      id: string,
      patch: { customKind: "emoji" | "sticker" | null; customName: string | null; width?: number; height?: number },
    ) {
      await db
        .update(globalImages)
        .set({
          customKind: patch.customKind,
          customName: patch.customName,
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.height !== undefined ? { height: patch.height } : {}),
        })
        .where(eq(globalImages.id, id));
      return this.getImageById(id);
    },

    // ── Folders (flat) ──

    async listFolders() {
      return db.select().from(galleryFolders).orderBy(galleryFolders.createdAt);
    },

    async getFolderById(id: string) {
      const rows = await db.select().from(galleryFolders).where(eq(galleryFolders.id, id));
      return rows[0] ?? null;
    },

    async createFolder(name: string) {
      const id = newId();
      await db.insert(galleryFolders).values({ id, name, createdAt: now() });
      return this.getFolderById(id);
    },

    async renameFolder(id: string, name: string) {
      await db.update(galleryFolders).set({ name }).where(eq(galleryFolders.id, id));
      return this.getFolderById(id);
    },

    async removeFolder(id: string) {
      // Unfile all images in this folder (move back to root), then delete it —
      // mirrors connection-folders, so we don't rely on FK ON DELETE SET NULL alone.
      await db.update(globalImages).set({ folderId: null }).where(eq(globalImages.folderId, id));
      await db.delete(galleryFolders).where(eq(galleryFolders.id, id));
    },
  };
}
