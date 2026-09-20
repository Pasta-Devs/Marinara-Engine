import {
  PRIVATE_NOTEBOOK_SETTINGS_PREFIX,
  privateNotebookDocumentSchema,
  privateNotebookStoredDocumentSchema,
  type PrivateNotebookContext,
  type PrivateNotebookDocument,
  type PrivateNotebookTarget,
  type PrivateNotebookUpdateInput,
} from "@marinara-engine/shared";
import type { DB } from "../db/connection.js";
import { and, eq, inArray, ne } from "../db/file-query.js";
import { appSettings, characters, chats } from "../db/schema/index.js";
import { now } from "../utils/id-generator.js";

export class PrivateNotebookChatNotFoundError extends Error {
  constructor() {
    super("Chat not found");
    this.name = "PrivateNotebookChatNotFoundError";
  }
}

export class PrivateNotebookScopeUnavailableError extends Error {
  constructor(public readonly target: PrivateNotebookTarget) {
    super("Private notebook scope is not available for this chat");
    this.name = "PrivateNotebookScopeUnavailableError";
  }
}

export class PrivateNotebookStoredDocumentError extends Error {
  constructor(public readonly target: PrivateNotebookTarget) {
    super("The saved private notebook document is unreadable");
    this.name = "PrivateNotebookStoredDocumentError";
  }
}

export class PrivateNotebookConflictError extends Error {
  constructor(public readonly current: PrivateNotebookDocument) {
    super("Private notebook document changed; reload it and try again");
    this.name = "PrivateNotebookConflictError";
  }
}

type NotebookChat = typeof chats.$inferSelect;

function parseCharacterIds(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function normalizedGroupId(chat: NotebookChat): string | null {
  return typeof chat.groupId === "string" && chat.groupId.length > 0 ? chat.groupId : null;
}

function settingsKey(target: PrivateNotebookTarget, chat: NotebookChat): string {
  switch (target.scope) {
    case "global":
      return `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}global`;
    case "character":
      return `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}character:${target.characterId}`;
    case "chat":
      return `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:${chat.id}`;
    case "branch-family": {
      const groupId = normalizedGroupId(chat);
      if (!groupId) throw new PrivateNotebookScopeUnavailableError(target);
      return `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}family:${groupId}`;
    }
  }
}

function emptyDocument(target: PrivateNotebookTarget): PrivateNotebookDocument {
  return privateNotebookDocumentSchema.parse({
    target,
    content: "",
    revision: 0,
    updatedAt: null,
  });
}

function parseDocumentRow(
  row: typeof appSettings.$inferSelect | undefined,
  target: PrivateNotebookTarget,
): PrivateNotebookDocument {
  if (!row) return emptyDocument(target);

  try {
    const stored = privateNotebookStoredDocumentSchema.parse(JSON.parse(row.value) as unknown);
    return privateNotebookDocumentSchema.parse({
      target,
      content: stored.content,
      revision: stored.revision,
      updatedAt: row.updatedAt,
    });
  } catch {
    throw new PrivateNotebookStoredDocumentError(target);
  }
}

async function readChat(db: DB, chatId: string): Promise<NotebookChat> {
  const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!rows[0]) throw new PrivateNotebookChatNotFoundError();
  return rows[0];
}

async function existingChatCharacterIds(db: DB, chat: NotebookChat): Promise<string[]> {
  const characterIds = parseCharacterIds(chat.characterIds);
  if (characterIds.length === 0) return [];
  const rows = await db.select({ id: characters.id }).from(characters).where(inArray(characters.id, characterIds));
  const existingIds = new Set(rows.map((row) => row.id));
  return characterIds.filter((id) => existingIds.has(id));
}

async function assertTargetAvailable(db: DB, chat: NotebookChat, target: PrivateNotebookTarget): Promise<void> {
  if (target.scope === "branch-family" && !normalizedGroupId(chat)) {
    throw new PrivateNotebookScopeUnavailableError(target);
  }
  if (target.scope !== "character") return;

  const activeCharacterIds = parseCharacterIds(chat.characterIds);
  if (!activeCharacterIds.includes(target.characterId)) {
    throw new PrivateNotebookScopeUnavailableError(target);
  }
  const rows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.id, target.characterId))
    .limit(1);
  if (!rows[0]) throw new PrivateNotebookScopeUnavailableError(target);
}

export async function readPrivateNotebookContext(db: DB, chatId: string): Promise<PrivateNotebookContext> {
  const chat = await readChat(db, chatId);
  const characterIds = await existingChatCharacterIds(db, chat);
  const targets: PrivateNotebookTarget[] = [
    { scope: "global" },
    ...characterIds.map((characterId): PrivateNotebookTarget => ({ scope: "character", characterId })),
    { scope: "chat" },
  ];
  if (normalizedGroupId(chat)) targets.push({ scope: "branch-family" });

  const keys = targets.map((target) => settingsKey(target, chat));
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));

  return {
    chatId: chat.id,
    mode: chat.mode,
    groupId: normalizedGroupId(chat),
    characterIds,
    documents: targets.map((target) => parseDocumentRow(rowsByKey.get(settingsKey(target, chat)), target)),
  };
}

export async function replacePrivateNotebookDocument(
  db: DB,
  chatId: string,
  input: PrivateNotebookUpdateInput,
): Promise<PrivateNotebookDocument> {
  return db.transaction(
    async (tx) => {
      const chat = await readChat(tx, chatId);
      await assertTargetAvailable(tx, chat, input.target);
      const key = settingsKey(input.target, chat);
      const rows = await tx.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      const existing = rows[0];
      const current = parseDocumentRow(existing, input.target);
      if (current.revision !== input.expectedRevision) throw new PrivateNotebookConflictError(current);

      const updatedAt = now();
      const stored = privateNotebookStoredDocumentSchema.parse({
        schemaVersion: 1,
        content: input.content,
        revision: current.revision + 1,
      });
      const row = { key, value: JSON.stringify(stored), updatedAt };
      if (existing) {
        await tx.update(appSettings).set(row).where(eq(appSettings.key, key));
      } else {
        await tx.insert(appSettings).values(row);
      }

      return privateNotebookDocumentSchema.parse({
        target: input.target,
        content: stored.content,
        revision: stored.revision,
        updatedAt,
      });
    },
    { durable: true },
  );
}

/**
 * Remove notebook rows owned by a permanently deleted chat. Call this with the
 * same transaction that deletes the chat so a failed deletion cannot orphan or
 * prematurely discard its notes.
 */
export async function deletePrivateNotebookRowsForChat(db: DB, chatId: string): Promise<void> {
  const rows = await db.select({ groupId: chats.groupId }).from(chats).where(eq(chats.id, chatId)).limit(1);
  const groupId = typeof rows[0]?.groupId === "string" && rows[0].groupId.length > 0 ? rows[0].groupId : null;

  await db.delete(appSettings).where(eq(appSettings.key, `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:${chatId}`));
  if (!groupId) return;

  const siblings = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.groupId, groupId), ne(chats.id, chatId)))
    .limit(1);
  if (siblings.length > 0) return;

  await db.delete(appSettings).where(eq(appSettings.key, `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}family:${groupId}`));
}

/** Remove the notebook row whose lifecycle is owned by a character. */
export async function deletePrivateNotebookRowsForCharacter(db: DB, characterId: string): Promise<void> {
  await db
    .delete(appSettings)
    .where(eq(appSettings.key, `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}character:${characterId}`));
}
