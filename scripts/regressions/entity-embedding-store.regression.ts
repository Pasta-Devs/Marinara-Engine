// Guards the persisted-embedding backing store for #4768 phase 2: content-hash
// staleness (an edit to an embed-relevant field invalidates the stored vector
// with no explicit hook), a narrow setter that never bumps updatedAt, and the
// Professor-Mari self-exclusion.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFESSOR_MARI_ID } from "../../packages/shared/src/constants/defaults.js";

process.env.FILE_STORAGE_DIR = mkdtempSync(join(tmpdir(), "marinara-entity-embed-"));

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { characters, chats } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createEntityEmbeddingStore } = await import("../../packages/server/src/services/entity-embedding-store.js");

const db = await createFileNativeDB();
const store = createEntityEmbeddingStore(db);

const STAMP = "2026-01-01T00:00:00.000Z";
async function insertCharacter(id: string, data: Record<string, unknown>) {
  await db.insert(characters).values({
    id,
    data: JSON.stringify(data),
    comment: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}

await insertCharacter("c1", { name: "Dracula", description: "a brooding immortal vampire", tags: ["undead"] });
await insertCharacter("c2", { name: "Bob", description: "a cheerful baker" });
// Professor Mari must never appear as a fetch candidate.
await insertCharacter(PROFESSOR_MARI_ID, { name: "Professor Mari", description: "the built-in assistant" });
// A record whose data is the JSON literal "null" must be skipped, not crash the
// whole projection (JSON.parse("null") === null).
await db.insert(characters).values({ id: "c-null", data: "null", comment: "", createdAt: STAMP, updatedAt: STAMP });

// ── Candidates project correctly; Mari + malformed rows excluded; embeddings null ──
{
  const candidates = await store.listCandidates("character");
  const ids = candidates.map((c) => c.id).sort();
  assert.deepEqual(ids, ["c1", "c2"], "Professor Mari and a null-data row must be excluded, without throwing");
  const dracula = candidates.find((c) => c.id === "c1")!;
  assert.equal(dracula.name, "Dracula");
  assert.match(dracula.embedText, /brooding immortal vampire/, "embed text must include the description");
  assert.match(dracula.embedText, /undead/, "embed text must include tags");
  assert.equal(dracula.embedding, null, "a fresh character has no stored embedding");
}

// ── updateEmbedding persists, and a matching-hash read returns the vector ──
const draculaText = (await store.listCandidates("character")).find((c) => c.id === "c1")!.embedText;
await store.updateEmbedding("character", "c1", [0.1, 0.2, 0.3], draculaText);
{
  const dracula = (await store.listCandidates("character")).find((c) => c.id === "c1")!;
  assert.deepEqual(dracula.embedding, [0.1, 0.2, 0.3], "a stored embedding with a matching hash is returned");
}

// ── The setter must NOT bump updatedAt (no recency churn) ──
{
  const row = (await db.select().from(characters).where(eq(characters.id, "c1")))[0] as { updatedAt?: string };
  assert.equal(row.updatedAt, STAMP, "persisting an embedding must not touch updatedAt");
}

// ── Content-hash staleness: editing an embed-relevant field invalidates it ──
{
  const nextData = { name: "Dracula", description: "a reformed pacifist gardener", tags: ["undead"] };
  await db.update(characters).set({ data: JSON.stringify(nextData) }).where(eq(characters.id, "c1"));
  const dracula = (await store.listCandidates("character")).find((c) => c.id === "c1")!;
  assert.match(dracula.embedText, /reformed pacifist gardener/, "embed text reflects the edit");
  assert.equal(dracula.embedding, null, "the stale embedding must read as absent after an embed-relevant edit");
}

// ── Re-embedding under the new text sticks; clearing to null works ──
{
  const dracula = (await store.listCandidates("character")).find((c) => c.id === "c1")!;
  await store.updateEmbedding("character", "c1", [0.9, 0.8], dracula.embedText);
  assert.deepEqual((await store.listCandidates("character")).find((c) => c.id === "c1")!.embedding, [0.9, 0.8]);
  await store.updateEmbedding("character", "c1", null, dracula.embedText);
  assert.equal((await store.listCandidates("character")).find((c) => c.id === "c1")!.embedding, null, "null clears the vector");
}

// ── A second table (chats) exercises the real db.update path for the flat-column
//    tables, not just characters ──
{
  await db.insert(chats).values({
    id: "chat1",
    name: "Vampire Council",
    mode: "conversation",
    characterIds: "[]",
    metadata: JSON.stringify({ tags: ["undead"], summary: "the vampires convene" }),
    createdAt: STAMP,
    updatedAt: STAMP,
  });
  const chat = (await store.listCandidates("chat")).find((c) => c.id === "chat1")!;
  assert.equal(chat.name, "Vampire Council");
  assert.match(chat.embedText, /undead/, "chat embed text includes metadata tags");
  assert.equal(chat.embedding, null);
  await store.updateEmbedding("chat", "chat1", [0.5, 0.5], chat.embedText);
  assert.deepEqual((await store.listCandidates("chat")).find((c) => c.id === "chat1")!.embedding, [0.5, 0.5]);
  const chatRow = (await db.select().from(chats).where(eq(chats.id, "chat1")))[0] as { updatedAt?: string };
  assert.equal(chatRow.updatedAt, STAMP, "persisting a chat embedding must not touch updatedAt");
}

// ── A different embedding source invalidates vectors persisted under another
//    (a same-dimension model swap must not silently mix incompatible vectors) ──
{
  const local = createEntityEmbeddingStore(db, "local");
  const remote = createEntityEmbeddingStore(db, "remote-model-v2");
  const chat = (await local.listCandidates("chat")).find((c) => c.id === "chat1")!;
  await local.updateEmbedding("chat", "chat1", [0.1, 0.2], chat.embedText);
  assert.deepEqual((await local.listCandidates("chat")).find((c) => c.id === "chat1")!.embedding, [0.1, 0.2], "same source reads its vector");
  assert.equal(
    (await remote.listCandidates("chat")).find((c) => c.id === "chat1")!.embedding,
    null,
    "a different embedding source treats the stored vector as stale",
  );
}

process.stdout.write("Entity embedding store regression passed.\n");
