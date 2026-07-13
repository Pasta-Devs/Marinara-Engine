import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import type { DB } from "../../../db/connection.js";
import * as schema from "../../../db/schema/index.js";
import { chats, messages, messageSwipes } from "../../../db/schema/index.js";
import { createMessagePublicationStorage } from "../../storage/message-publication.storage.js";
import { createChatsStorage } from "../../storage/chats.storage.js";

async function createPublicationTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-publication-"));
  const client = createClient({ url: `file:${join(tempDir, "publication.db")}` });
  await client.execute(`CREATE TABLE chats (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, mode TEXT NOT NULL,
    character_ids TEXT NOT NULL DEFAULT '[]', group_id TEXT, persona_id TEXT,
    prompt_preset_id TEXT, connection_id TEXT, metadata TEXT NOT NULL DEFAULT '{}',
    connected_chat_id TEXT, folder_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE messages (
    id TEXT PRIMARY KEY NOT NULL, chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL, character_id TEXT, content TEXT NOT NULL DEFAULT '',
    active_swipe_index INTEGER NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'canonical', publication_turn_id TEXT,
    promoted_at TEXT, rejected_at TEXT, rejection_reason TEXT,
    extra TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE message_swipes (
    id TEXT PRIMARY KEY NOT NULL, message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    "index" INTEGER NOT NULL, content TEXT NOT NULL DEFAULT '',
    publication_status TEXT NOT NULL DEFAULT 'canonical', publication_turn_id TEXT,
    promoted_at TEXT, rejected_at TEXT, rejection_reason TEXT,
    extra TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  )`);
  const db = drizzle(client, { schema }) as unknown as DB;
  const timestamp = new Date().toISOString();
  await db.insert(chats).values({ id: "chat-1", name: "Test", mode: "roleplay", createdAt: timestamp, updatedAt: timestamp });
  return {
    client,
    db,
    cleanup() {
      client.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test("candidate messages promote atomically and advance chat recency only after approval", async () => {
  const { db, cleanup } = await createPublicationTestDatabase();
  try {
    const publication = createMessagePublicationStorage(db);
    const candidate = await publication.createCandidate({ chatId: "chat-1", content: "draft", turnId: "turn-1" });
    assert.equal(candidate.publicationStatus, "candidate");
    const transcripts = createChatsStorage(db);
    assert.equal((await transcripts.listMessages("chat-1")).length, 0);
    assert.equal(await transcripts.countMessages("chat-1"), 0);

    const chatBefore = (await db.select().from(chats).where(eq(chats.id, "chat-1")))[0]!;
    assert.equal(chatBefore.lastMessageAt, null);

    const promoted = await publication.promoteCandidate(candidate.id, "turn-1", "approved");
    assert.equal(promoted.status, "promoted");
    const storedMessage = (await db.select().from(messages).where(eq(messages.id, candidate.id)))[0]!;
    const storedSwipe = (await db.select().from(messageSwipes).where(eq(messageSwipes.messageId, candidate.id)))[0]!;
    assert.equal(storedMessage.publicationStatus, "canonical");
    assert.equal(storedSwipe.publicationStatus, "canonical");
    assert.equal(storedMessage.content, "approved");
    assert.equal(storedSwipe.content, "approved");
    assert.ok(storedMessage.promotedAt);
    assert.deepEqual((await transcripts.listMessages("chat-1")).map((row) => row.content), ["approved"]);
    assert.equal(await transcripts.countMessages("chat-1"), 1);

    assert.deepEqual(await publication.promoteCandidate(candidate.id, "turn-1", "other"), { status: "already_canonical" });
    assert.deepEqual(await publication.rejectCandidate(candidate.id, "turn-1", "late"), { status: "already_canonical" });
    assert.deepEqual(await publication.promoteCandidate(candidate.id, "wrong-turn", "other"), { status: "turn_conflict" });
  } finally {
    cleanup();
  }
});

test("rejected candidates remain audit-only and cannot be promoted", async () => {
  const { db, cleanup } = await createPublicationTestDatabase();
  try {
    const publication = createMessagePublicationStorage(db);
    const candidate = await publication.createCandidate({ chatId: "chat-1", content: "unsafe", turnId: "turn-2" });
    const rejected = await publication.rejectCandidate(candidate.id, "turn-2", "agency violation");
    assert.equal(rejected.status, "rejected");
    assert.deepEqual(await publication.rejectCandidate(candidate.id, "turn-2", "duplicate cleanup"), {
      status: "already_rejected",
    });

    const storedMessage = (await db.select().from(messages).where(eq(messages.id, candidate.id)))[0]!;
    const storedSwipe = (await db.select().from(messageSwipes).where(eq(messageSwipes.messageId, candidate.id)))[0]!;
    assert.equal(storedMessage.publicationStatus, "rejected");
    assert.equal(storedSwipe.publicationStatus, "rejected");
    assert.equal(storedMessage.rejectionReason, "agency violation");
    const transcripts = createChatsStorage(db);
    assert.equal((await transcripts.listMessages("chat-1")).length, 0);
    assert.equal(await transcripts.countMessages("chat-1"), 0);
    assert.equal((await transcripts.listMessagesForAudit("chat-1")).length, 1);
    assert.deepEqual(await publication.promoteCandidate(candidate.id, "turn-2", "nope"), { status: "already_rejected" });

    const chatAfter = (await db.select().from(chats).where(eq(chats.id, "chat-1")))[0]!;
    assert.equal(chatAfter.lastMessageAt, null);
  } finally {
    cleanup();
  }
});
