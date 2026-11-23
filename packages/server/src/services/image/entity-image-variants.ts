import { existsSync } from "node:fs";
import { isGalleryTagKind, parseChatImageGenerationRecord } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { eq, inArray } from "../../db/file-query.js";
import { characterImages, personaImages, chatImages } from "../../db/schema/index.js";
import { newId } from "../../utils/id-generator.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { withChatImageVariantLock } from "./chat-image-variants.js";
import { loadImageGenerationUserSettings } from "./image-generation-settings.js";
import { resolveStoredGalleryFile } from "./gallery-file-lifecycle.js";

export type EntityImageKind = "character" | "persona";
const queues = new Map<string, Promise<unknown>>();

export async function withEntityImageVariantLock<T>(
  kind: EntityImageKind,
  ownerId: string,
  operation: () => Promise<T>,
) {
  const key = JSON.stringify([kind, ownerId]);
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation);
  queues.set(key, next);
  try {
    return await next;
  } finally {
    if (queues.get(key) === next) queues.delete(key);
  }
}

function ownerTable(kind: EntityImageKind) {
  return kind === "character" ? characterImages : personaImages;
}

async function ownerImages(db: DB, kind: EntityImageKind, ownerId: string) {
  return kind === "character"
    ? createCharacterGalleryStorage(db).listByCharacterId(ownerId)
    : createPersonaGalleryStorage(db).listByPersonaId(ownerId);
}

type EntityImage = typeof characterImages.$inferSelect | typeof personaImages.$inferSelect;

async function selectInTransaction(
  tx: DB,
  kind: EntityImageKind,
  ownerId: string,
  imageId: string,
  sourceId = imageId,
) {
  const rows = await ownerImages(tx, kind, ownerId);
  const image = rows.find((row) => row.id === imageId);
  const source = rows.find((row) => row.id === sourceId);
  if (!image || !source) throw new Error("Gallery image not found");
  if (image.variantGroupId && source.variantGroupId && image.variantGroupId !== source.variantGroupId)
    throw new Error("Image versions belong to different stacks");
  const groupId = source.variantGroupId ?? image.variantGroupId ?? newId();
  const members = rows.filter((row) => row.variantGroupId === groupId || row.id === source.id || row.id === image.id);
  const table = ownerTable(kind);
  await tx
    .update(table)
    .set({ variantGroupId: groupId, variantSelected: 0 })
    .where(
      inArray(
        table.id,
        members.map((row) => row.id),
      ),
    );
  await tx.update(table).set({ variantSelected: 1 }).where(eq(table.id, image.id));
  return { ...image, variantGroupId: groupId, variantSelected: 1 };
}

/** A gallery selection changes only that owner's rows, never chat attachments or another gallery. */
export function selectEntityImageVersion(db: DB, kind: EntityImageKind, ownerId: string, imageId: string) {
  return withEntityImageVariantLock(kind, ownerId, () =>
    db.transaction((tx) => selectInTransaction(tx, kind, ownerId, imageId)),
  );
}

/** Metadata creation and grouping commit together; a deleted source cannot leave an orphan result. */
export function appendEntityImageVersion(
  db: DB,
  kind: EntityImageKind,
  ownerId: string,
  sourceId: string,
  create: (tx: DB) => Promise<EntityImage | null>,
) {
  return withEntityImageVariantLock(kind, ownerId, () =>
    db.transaction(async (tx) => {
      if (!(await ownerImages(tx, kind, ownerId)).some((row) => row.id === sourceId))
        throw new Error("Gallery image not found");
      const image = await create(tx);
      if (!image) throw new Error("Edited image metadata could not be saved");
      return selectInTransaction(tx, kind, ownerId, image.id, sourceId);
    }),
  );
}

type ChatImage = typeof chatImages.$inferSelect;

/** Caller holds the chat queue. Copy metadata only; all memberships retain the canonical file path. */
async function addChatVersion(db: DB, kind: EntityImageKind, ownerId: string, stack: ChatImage[], target?: ChatImage) {
  return withEntityImageVariantLock(kind, ownerId, () =>
    db.transaction(async (tx) => {
      const all = await ownerImages(tx, kind, ownerId);
      const ids = new Set(stack.map((row) => row.id));
      const linked = all.filter((row) => row.sourceChatImageId && ids.has(row.sourceChatImageId));
      const groupId = linked.find((row) => row.variantGroupId)?.variantGroupId ?? newId();
      // Selection/editing can establish a group before chat history is reconciled.
      // Record completion separately so later gallery deletions remain respected.
      const legacy = linked.some((row) => row.variantHistoryRecovered !== 1);
      const candidates = legacy ? stack : target ? [target] : [];
      const members = all.filter((row) => row.variantGroupId === groupId || linked.some((item) => item.id === row.id));
      const selected = members.find((row) => row.variantSelected === 1) ?? members[0];
      for (const row of candidates) {
        if (linked.some((existing) => existing.sourceChatImageId === row.id)) continue;
        const file = resolveStoredGalleryFile(row.filePath);
        if (!file || !existsSync(file.absolutePath)) continue;
        const fields = {
          sourceChatImageId: row.id,
          filePath: row.filePath,
          prompt: row.prompt,
          customKind: isGalleryTagKind(row.customKind) ? row.customKind : null,
          customName: row.customName,
          description: row.description,
          generation: parseChatImageGenerationRecord(row.generation),
          provider: row.provider,
          model: row.model,
          width: row.width ?? undefined,
          height: row.height ?? undefined,
          variantGroupId: groupId,
          variantHistoryRecovered: 1,
          variantSelected: !selected && row.id === target?.id ? 1 : 0,
          createdAt: row.createdAt,
        };
        const created =
          kind === "character"
            ? await createCharacterGalleryStorage(tx).create({ characterId: ownerId, ...fields })
            : await createPersonaGalleryStorage(tx).create({ personaId: ownerId, ...fields });
        if (!created) throw new Error("Gallery image metadata could not be saved");
      }
      const table = ownerTable(kind);
      for (const row of members)
        await tx
          .update(table)
          .set({
            variantGroupId: groupId,
            variantHistoryRecovered: 1,
            variantSelected: row.id === selected?.id ? 1 : 0,
            generation:
              row.generation ?? stack.find((source) => source.id === row.sourceChatImageId)?.generation ?? null,
          })
          .where(eq(table.id, row.id));
    }),
  );
}

/** Preserve actual gallery destinations even when an edit's generation references are empty. */
export async function persistChatImageVersionToEntityGalleries(
  db: DB,
  input: {
    chatId: string;
    imageId: string;
    enabled: boolean;
    characterIds: string[];
    personaIds: string[];
  },
) {
  if (!input.enabled) return;
  // Invoked inside the chat variant queue by the regeneration route.
  const images = await createGalleryStorage(db).listByChatId(input.chatId);
  const target = images.find((row) => row.id === input.imageId);
  if (!target) return;
  const stack = images.filter(
    (row) => row.id === target.id || (!!target.variantGroupId && row.variantGroupId === target.variantGroupId),
  );
  const ids = stack.map((row) => row.id);
  const characters = await db.select().from(characterImages).where(inArray(characterImages.sourceChatImageId, ids));
  const personas = await db.select().from(personaImages).where(inArray(personaImages.sourceChatImageId, ids));
  for (const id of new Set([...input.characterIds, ...characters.map((row) => row.characterId)]))
    await addChatVersion(db, "character", id, stack, target);
  for (const id of new Set([...input.personaIds, ...personas.map((row) => row.personaId)]))
    await addChatVersion(db, "persona", id, stack, target);
}

/** Recover pre-fix missing memberships only from explicit source links. A completed group is never refilled. */
export async function repairEntityImageVariants(db: DB, kind: EntityImageKind, ownerId: string) {
  const legacy = (await ownerImages(db, kind, ownerId)).filter(
    (row) => row.sourceChatImageId && row.variantHistoryRecovered !== 1,
  );
  if (!legacy.length || !(await loadImageGenerationUserSettings(db)).autoSaveToGalleries) return;
  const sources = await db
    .select()
    .from(chatImages)
    .where(
      inArray(
        chatImages.id,
        legacy.map((row) => row.sourceChatImageId!),
      ),
    );
  for (const chatId of new Set(sources.map((row) => row.chatId))) {
    const groups = new Set(
      sources.filter((row) => row.chatId === chatId && row.variantGroupId).map((row) => row.variantGroupId),
    );
    if (!groups.size) continue;
    await withChatImageVariantLock(chatId, async () => {
      const current = await createGalleryStorage(db).listByChatId(chatId);
      for (const groupId of groups) {
        const stack = current.filter((row) => row.variantGroupId === groupId);
        if (stack.length) await addChatVersion(db, kind, ownerId, stack);
      }
    });
  }
}
