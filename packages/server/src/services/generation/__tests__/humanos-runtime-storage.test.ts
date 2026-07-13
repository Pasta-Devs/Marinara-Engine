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
import { gameEngineState, stateCommitLedger, stateParityVerifications, stateTargetHeads } from "../../../db/schema/index.js";
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
  await client.execute(`CREATE TABLE state_parity_verifications (
    id TEXT PRIMARY KEY NOT NULL,
    proposal_id TEXT,
    adapter_kind TEXT NOT NULL,
    target_key TEXT NOT NULL,
    legacy_hash TEXT NOT NULL,
    predicted_hash TEXT NOT NULL,
    matched INTEGER NOT NULL,
    diagnostic_json TEXT,
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_target_heads (
    target_key TEXT PRIMARY KEY NOT NULL,
    target_kind TEXT NOT NULL,
    target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    last_commit_id TEXT,
    state_hash TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_commit_ledger (
    id TEXT PRIMARY KEY NOT NULL,
    proposal_id TEXT NOT NULL,
    target_key TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL,
    base_revision INTEGER NOT NULL,
    result_revision INTEGER NOT NULL,
    operation TEXT NOT NULL,
    patch_json TEXT NOT NULL,
    patch_hash TEXT NOT NULL,
    before_hash TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    evidence_kind TEXT NOT NULL,
    evidence_chat_id TEXT,
    evidence_turn_id TEXT,
    evidence_message_id TEXT,
    evidence_swipe_index INTEGER,
    evidence_content_hash TEXT,
    evidence_canonical_revision INTEGER,
    evidence_reason TEXT,
    evidence_source_hash TEXT,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL,
    authority_record_id TEXT,
    batch_id TEXT NOT NULL,
    commit_order INTEGER NOT NULL DEFAULT 0,
    commit_group_id TEXT,
    dependency_commit_ids TEXT NOT NULL DEFAULT '[]',
    compensates_commit_id TEXT,
    idempotency_key TEXT NOT NULL,
    committed_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_state_commit_ledger_proposal ON state_commit_ledger(proposal_id)");
  await client.execute("CREATE UNIQUE INDEX idx_state_commit_ledger_idempotency ON state_commit_ledger(idempotency_key)");
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

    const heads = await db.select().from(stateTargetHeads);
    assert.equal(heads.length, 1);
    assert.equal(heads[0]?.targetKey, "humanos_runtime:chat-1");
    assert.equal(heads[0]?.revision, 2);

    const ledgerRows = await db
      .select()
      .from(stateCommitLedger)
      .orderBy(asc(stateCommitLedger.resultRevision));
    assert.equal(ledgerRows.length, 2);
    assert.deepEqual(ledgerRows.map((row) => row.baseRevision), [0, 1]);
    assert.deepEqual(ledgerRows.map((row) => row.resultRevision), [1, 2]);

    const parityRows = await db.select().from(stateParityVerifications);
    assert.equal(parityRows.length, 2);
    assert.ok(parityRows.every((row) => row.matched));
    assert.deepEqual(parityRows.map((row) => row.targetKey), ["humanos_runtime:chat:chat-1", "humanos_runtime:chat:chat-1"]);
  } finally {
    cleanup();
  }
});

test("HumanOS Runtime parity failure cannot reject or roll back an authoritative legacy commit", async () => {
  const { db, cleanup } = await createRuntimeTestDatabase();
  try {
    const runtime = createHumanOSRuntimeStorage(db);
    const result = await runtime.commit(commitInput({ state: "{malformed" }));
    assert.equal(result.status, "committed");
    assert.equal((await db.select().from(gameEngineState)).length, 1);
    assert.equal((await db.select().from(stateCommitLedger)).length, 1);
    assert.equal((await db.select().from(stateTargetHeads)).length, 1);
    assert.equal((await db.select().from(stateParityVerifications)).length, 0);
  } finally {
    cleanup();
  }
});

test("HumanOS Runtime fails closed when the governed head diverges from the projection", async () => {
  const { db, cleanup } = await createRuntimeTestDatabase();
  try {
    const runtime = createHumanOSRuntimeStorage(db);
    const first = await runtime.commit(commitInput());
    assert.equal(first.status, "committed");

    await db
      .update(stateTargetHeads)
      .set({ stateHash: "corrupt-head-hash" })
      .where(eq(stateTargetHeads.targetKey, "humanos_runtime:chat-1"));

    await assert.rejects(
      runtime.commit(
        commitInput({
          messageId: "message-2",
          state: JSON.stringify({ trust: 0.5 }),
          baseRevision: 1,
          turnId: "turn-2",
          sourceContentHash: "b".repeat(64),
          idempotencyKey: "key-2",
        }),
      ),
      /Governed projection hash mismatch/,
    );

    const rows = await db.select().from(gameEngineState).where(eq(gameEngineState.chatId, "chat-1"));
    assert.equal(rows.length, 1);
    const ledgerRows = await db.select().from(stateCommitLedger);
    assert.equal(ledgerRows.length, 1);
    const heads = await db.select().from(stateTargetHeads);
    assert.equal(heads[0]?.revision, 1);
  } finally {
    cleanup();
  }
});
