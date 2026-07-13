import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { asc, eq } from "drizzle-orm";
import type { DB } from "../../../db/connection.js";
import * as schema from "../../../db/schema/index.js";
import { gameEngineState } from "../../../db/schema/index.js";
import { createHumanOSRuntimeStorage, type CommitHumanOSRuntimeInput } from "../../storage/humanos-runtime.storage.js";

async function createRuntimeTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-humanos-runtime-"));
  const client = createClient({ url: `file:${join(tempDir, "runtime.db")}` });
  await client.execute(`CREATE TABLE game_engine_state (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL DEFAULT '',
    swipe_index INTEGER NOT NULL DEFAULT 0,
    game_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    state TEXT NOT NULL,
    committed INTEGER NOT NULL DEFAULT 0,
    revision INTEGER,
    base_revision INTEGER,
    turn_id TEXT,
    source_content_hash TEXT,
    patch_type TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL
  )`);
  await client.execute(
    "CREATE UNIQUE INDEX idx_game_engine_state_idempotency ON game_engine_state(idempotency_key) WHERE idempotency_key IS NOT NULL",
  );
  return {
    client,
    db: drizzle(client, { schema }) as unknown as DB,
    cleanup() {
      client.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function commitInput(overrides: Partial<CommitHumanOSRuntimeInput> = {}): CommitHumanOSRuntimeInput {
  return {
    chatId: "chat-1",
    messageId: "message-1",
    swipeIndex: 0,
    state: JSON.stringify({ trust: 0.25 }),
    baseRevision: 0,
    turnId: "turn-1",
    sourceContentHash: "a".repeat(64),
    patchType: "humanos-runtime",
    idempotencyKey: "key-1",
    ...overrides,
  };
}

test("HumanOS Runtime commits are revision-checked, idempotent, and append-only", async () => {
  const { db, cleanup } = await createRuntimeTestDatabase();
  try {
    const runtime = createHumanOSRuntimeStorage(db);
    const firstInput = commitInput();

    const first = await runtime.commit(firstInput);
    assert.equal(first.status, "committed");
    if (first.status !== "committed") return;
    assert.equal(first.row.baseRevision, 0);
    assert.equal(first.row.revision, 1);

    const replay = await runtime.commit(firstInput);
    assert.equal(replay.status, "replayed");
    if (replay.status !== "replayed") return;
    assert.equal(replay.row.id, first.row.id);

    const conflictingReplay = await runtime.commit({
      ...firstInput,
      state: JSON.stringify({ trust: 0.9 }),
    });
    assert.deepEqual(conflictingReplay, { status: "idempotency_conflict" });

    const stale = await runtime.commit(commitInput({
      messageId: "message-2",
      turnId: "turn-2",
      sourceContentHash: "b".repeat(64),
      idempotencyKey: "key-2",
    }));
    assert.deepEqual(stale, {
      status: "revision_conflict",
      expectedRevision: 0,
      currentRevision: 1,
    });

    const second = await runtime.commit(commitInput({
      messageId: "message-2",
      state: JSON.stringify({ trust: 0.5 }),
      baseRevision: 1,
      turnId: "turn-2",
      sourceContentHash: "b".repeat(64),
      idempotencyKey: "key-2",
    }));
    assert.equal(second.status, "committed");
    if (second.status !== "committed") return;
    assert.equal(second.row.revision, 2);

    const rows = await db
      .select()
      .from(gameEngineState)
      .where(eq(gameEngineState.chatId, "chat-1"))
      .orderBy(asc(gameEngineState.revision));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.revision), [1, 2]);
    assert.deepEqual(rows.map((row) => row.messageId), ["message-1", "message-2"]);

    const latest = await runtime.getLatestCommitted("chat-1");
    assert.equal(latest?.revision, 2);
    assert.equal(latest?.messageId, "message-2");
  } finally {
    cleanup();
  }
});
