import { basename } from "node:path";
import { groupChatImageVariants } from "@marinara-engine/shared";
import { and, eq, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { chatImages, chats, messages, messageSwipes } from "../../db/schema/index.js";
import { withChatMessagePatchTransaction } from "../storage/chats.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createGameStoryboardsStorage } from "../storage/game-storyboards.storage.js";
import { deleteChatGalleryImageEverywhere } from "./chat-gallery-cascade-deletion.js";

const queues = new Map<string, Promise<unknown>>();

/** Selection, deletion and generation commits share this queue; provider calls never hold it. */
export async function withChatImageVariantLock<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(chatId) ?? Promise.resolve()).catch(() => undefined).then(operation);
  queues.set(chatId, next);
  try {
    return await next;
  } finally {
    if (queues.get(chatId) === next) queues.delete(chatId);
  }
}

type ImageRow = typeof chatImages.$inferSelect;

export function chatImageVariantUrl(image: Pick<ImageRow, "chatId" | "filePath">) {
  return `/api/gallery/file/${encodeURIComponent(image.chatId)}/${encodeURIComponent(basename(image.filePath.replace(/\\/g, "/")))}`;
}

async function replaceReferences(tx: DB, chatId: string, ids: string[], selected: ImageRow | null) {
  const oldIds = new Set(ids);
  const patch = selected
    ? { galleryId: selected.id, url: chatImageVariantUrl(selected), prompt: selected.prompt }
    : null;
  const swap = (raw: unknown) => {
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const extra = parsed as Record<string, unknown>;
    if (!Array.isArray(extra.attachments)) return null;
    let changed = false;
    const attachments = extra.attachments.flatMap((attachment: unknown) => {
      if (
        !attachment ||
        typeof attachment !== "object" ||
        !oldIds.has(String((attachment as Record<string, unknown>).galleryId))
      )
        return [attachment];
      changed = true;
      return patch ? [{ ...attachment, ...patch }] : [];
    });
    return changed ? JSON.stringify({ ...extra, attachments }) : null;
  };
  const replacedMessageIds: string[] = [];
  for (const message of await tx.select().from(messages).where(eq(messages.chatId, chatId))) {
    let changed = false;
    const extra = swap(message.extra);
    if (extra) {
      await tx.update(messages).set({ extra }).where(eq(messages.id, message.id));
      changed = true;
    }
    for (const swipe of await tx.select().from(messageSwipes).where(eq(messageSwipes.messageId, message.id))) {
      const swipeExtra = swap(swipe.extra);
      if (!swipeExtra) continue;
      await tx.update(messageSwipes).set({ extra: swipeExtra }).where(eq(messageSwipes.id, swipe.id));
      changed = true;
    }
    if (changed) replacedMessageIds.push(message.id);
  }
  const storyboards = createGameStoryboardsStorage(tx);
  const replacedKeyframeIds: string[] = [];
  for (const id of ids)
    for (const frame of await storyboards.listKeyframesByChatImageId(chatId, id)) {
      await storyboards.updateKeyframe(frame.id, { chatImageId: selected?.id ?? null });
      replacedKeyframeIds.push(frame.id);
    }
  return { replacedMessageIds, replacedKeyframeIds };
}

async function selectVersion(db: DB, chatId: string, imageId: string, sourceId?: string) {
  return withChatMessagePatchTransaction(db, chatId, async (tx) => {
    if (!(await tx.select({ id: chats.id }).from(chats).where(eq(chats.id, chatId))).length)
      throw new Error("Chat not found");
    const storage = createGalleryStorage(tx);
    const image = await storage.getById(imageId, chatId);
    const source = sourceId ? await storage.getById(sourceId, chatId) : image;
    if (!image || !source) throw new Error("Image not found");
    if (sourceId) {
      const groupId = source.variantGroupId || source.id;
      await tx
        .update(chatImages)
        .set({ variantGroupId: groupId })
        .where(and(eq(chatImages.chatId, chatId), inArray(chatImages.id, [source.id, image.id])));
    }
    const rows = await storage.listByChatId(chatId);
    const stack = groupChatImageVariants(rows).find((group) => group.versions.some((row) => row.id === image.id))!;
    const ids = stack.versions.map((row) => row.id);
    await tx
      .update(chatImages)
      .set({ variantSelected: 0 })
      .where(and(eq(chatImages.chatId, chatId), inArray(chatImages.id, ids)));
    await tx
      .update(chatImages)
      .set({ variantSelected: 1 })
      .where(and(eq(chatImages.chatId, chatId), eq(chatImages.id, image.id)));
    const selected = (await storage.getById(image.id, chatId))!;
    const replaced = await replaceReferences(tx, chatId, ids, selected);
    return { image: { ...selected, url: chatImageVariantUrl(selected) }, ...replaced };
  });
}

export function selectChatImageVersion(db: DB, chatId: string, imageId: string, sourceId?: string) {
  return withChatImageVariantLock(chatId, () => selectVersion(db, chatId, imageId, sourceId));
}

export function deleteChatImageVersions(
  db: DB,
  chatId: string,
  imageId: string,
  scope: "version" | "others" | "stack" = "version",
) {
  return withChatImageVariantLock(chatId, async () => {
    const rows = await createGalleryStorage(db).listByChatId(chatId);
    const stack = groupChatImageVariants(rows).find((group) => group.versions.some((row) => row.id === imageId));
    if (!stack) throw new Error("Image not found");
    const removed = stack.versions.filter(
      (row) => scope === "stack" || (scope === "others" ? row.id !== imageId : row.id === imageId),
    );
    const removedIds = new Set(removed.map((row) => row.id));
    const survivors = stack.versions.filter((row) => !removedIds.has(row.id));
    const selected =
      survivors.find((row) => row.id === (scope === "others" ? imageId : stack.selected.id)) ??
      survivors[survivors.length - 1];
    if (selected) await selectVersion(db, chatId, selected.id);
    else
      await withChatMessagePatchTransaction(db, chatId, (tx) => replaceReferences(tx, chatId, [...removedIds], null));
    for (const image of removed) await deleteChatGalleryImageEverywhere({ db, image });
    return { deletedImageIds: [...removedIds], selectedImageId: selected?.id ?? null };
  });
}
