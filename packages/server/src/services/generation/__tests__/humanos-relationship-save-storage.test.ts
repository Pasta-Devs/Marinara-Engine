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
import { relationshipCheckpoints, relationshipSaves, stateAuthorityRecords, stateCommitLedger, stateTargetHeads } from "../../../db/schema/index.js";
import {
  createRelationshipSavesStorage,
  relationshipCheckpointTargetKey,
  relationshipSaveTargetKey,
} from "../../storage/relationship-saves.storage.js";

async function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-relationship-save-"));
  const client = createClient({ url: `file:${join(tempDir, "relationship.db")}` });
  await client.execute(`CREATE TABLE state_authority_records (
    id TEXT PRIMARY KEY NOT NULL, authority_kind TEXT NOT NULL, actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL, authority_path TEXT NOT NULL, target_key TEXT NOT NULL,
    reason TEXT NOT NULL, issued_by TEXT NOT NULL, authorization_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_state_authority_records_authorization ON state_authority_records(authorization_key)");
  await client.execute(`CREATE TABLE state_target_heads (
    target_key TEXT PRIMARY KEY NOT NULL, target_kind TEXT NOT NULL, target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, last_commit_id TEXT,
    state_hash TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_commit_ledger (
    id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL, target_key TEXT NOT NULL,
    target_kind TEXT NOT NULL, target_scope TEXT NOT NULL, target_id TEXT NOT NULL,
    base_revision INTEGER NOT NULL, result_revision INTEGER NOT NULL, operation TEXT NOT NULL,
    patch_json TEXT NOT NULL, patch_hash TEXT NOT NULL, before_hash TEXT NOT NULL,
    result_hash TEXT NOT NULL, evidence_kind TEXT NOT NULL, evidence_chat_id TEXT,
    evidence_turn_id TEXT, evidence_message_id TEXT, evidence_swipe_index INTEGER,
    evidence_content_hash TEXT, evidence_canonical_revision INTEGER, evidence_reason TEXT,
    evidence_source_hash TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL, authority_record_id TEXT, batch_id TEXT NOT NULL, commit_order INTEGER NOT NULL DEFAULT 0,
    commit_group_id TEXT, dependency_commit_ids TEXT NOT NULL DEFAULT '[]', compensates_commit_id TEXT,
    idempotency_key TEXT NOT NULL, committed_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_state_commit_ledger_proposal ON state_commit_ledger(proposal_id)");
  await client.execute("CREATE UNIQUE INDEX idx_state_commit_ledger_idempotency ON state_commit_ledger(idempotency_key)");
  await client.execute(`CREATE TABLE relationship_saves (
    id TEXT PRIMARY KEY NOT NULL, target_key TEXT NOT NULL, chat_id TEXT NOT NULL,
    character_id TEXT NOT NULL, persona_id TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT '{}',
    active_truth_count INTEGER NOT NULL DEFAULT 0, milestone_count INTEGER NOT NULL DEFAULT 0,
    last_checkpoint_id TEXT, projection_hash TEXT NOT NULL DEFAULT '', source_commit_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_relationship_saves_target ON relationship_saves(target_key)");
  await client.execute(`CREATE TABLE relationship_checkpoints (
    id TEXT PRIMARY KEY NOT NULL, relationship_save_id TEXT NOT NULL, target_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL,
    canonical_message_count INTEGER NOT NULL, start_message_id TEXT NOT NULL, end_message_id TEXT NOT NULL,
    message_hashes TEXT NOT NULL DEFAULT '[]', previous_checkpoint_id TEXT, policy_version TEXT NOT NULL,
    character_truth_tokens INTEGER NOT NULL DEFAULT 0, active_state TEXT NOT NULL DEFAULT '{}',
    classifications TEXT NOT NULL DEFAULT '[]', source_commit_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'valid', creation_reason TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  return {
    db: drizzle(client, { schema }) as unknown as DB,
    cleanup() { client.close(); rmSync(tempDir, { recursive: true, force: true }); },
  };
}

function saveInput(overrides: Record<string, unknown> = {}) {
  const chatId = typeof overrides.chatId === "string" ? overrides.chatId : "chat-1";
  const characterId = typeof overrides.characterId === "string" ? overrides.characterId : "char-1";
  const personaId = typeof overrides.personaId === "string" ? overrides.personaId : "persona-1";
  const idempotencyKey = typeof overrides.idempotencyKey === "string" ? overrides.idempotencyKey : "save-key-1";
  return {
    chatId, characterId, personaId,
    state: JSON.stringify({ trust: 1 }), activeTruthCount: 1, milestoneCount: 0,
    baseRevision: 0, evidenceMessageId: "message-1", evidenceSwipeIndex: 0,
    evidenceContentHash: "a".repeat(64), actorType: "user", actorId: "local-user",
    authorityPath: "manual_edit",
    explicitAuthority: {
      actorType: "user", actorId: "local-user", authorityPath: "manual_edit",
      targetKey: relationshipSaveTargetKey(chatId, characterId, personaId),
      reason: "test manual save", issuedBy: "test", authorizationKey: idempotencyKey,
    },
    idempotencyKey,
    ...overrides,
  } as Parameters<ReturnType<typeof createRelationshipSavesStorage>["commit"]>[0];
}

function checkpointInput(overrides: Record<string, unknown> = {}) {
  return {
    chatId: "chat-1", characterId: "char-1", personaId: "persona-1",
    canonicalMessageCount: 10, startMessageId: "message-1", endMessageId: "message-10",
    messageHashes: ["a".repeat(64), "b".repeat(64)], policyVersion: "policy-1",
    characterTruthTokens: 120, activeState: JSON.stringify({ trust: 1 }),
    classifications: JSON.stringify([{ retention: "milestone" }]), sourceCommitIds: [],
    creationReason: "ten-canonical-messages", baseRevision: 0, idempotencyKey: "checkpoint-key-1",
    ...overrides,
  } as Parameters<ReturnType<typeof createRelationshipSavesStorage>["createCheckpoint"]>[0];
}

test("Relationship Saves isolate tuple identities and reject stale revisions", async () => {
  const { db, cleanup } = await createTestDatabase();
  try {
    const storage = createRelationshipSavesStorage(db);
    const first = await storage.commit(saveInput());
    assert.equal(first.status, "committed");
    const otherPersona = await storage.commit(saveInput({ personaId: "persona-2", idempotencyKey: "save-other" }));
    assert.equal(otherPersona.status, "committed");
    assert.notEqual("row" in first && first.row.id, "row" in otherPersona && otherPersona.row.id);
    assert.equal((await storage.get("chat-1", "char-1", "persona-1"))?.revision, 1);
    assert.equal((await storage.get("chat-1", "char-1", "persona-2"))?.revision, 1);
    const stale = await storage.commit(saveInput({ idempotencyKey: "save-stale" }));
    assert.deepEqual(stale, { status: "revision_conflict", expectedRevision: 0, currentRevision: 1 });
  } finally { cleanup(); }
});

test("Relationship Save retries are exact, count-sensitive, and replay after newer commits", async () => {
  const { db, cleanup } = await createTestDatabase();
  try {
    const storage = createRelationshipSavesStorage(db);
    const original = saveInput();
    const first = await storage.commit(original);
    assert.equal(first.status, "committed");
    assert.equal((await storage.commit(original)).status, "replayed");
    assert.equal((await storage.commit(saveInput({ activeTruthCount: 2 }))).status, "idempotency_conflict");
    const second = await storage.commit(saveInput({ state: JSON.stringify({ trust: 2 }), baseRevision: 1, idempotencyKey: "save-key-2", evidenceMessageId: "message-2", evidenceContentHash: "b".repeat(64) }));
    assert.equal(second.status, "committed");
    assert.equal((await storage.commit(original)).status, "replayed");
    assert.equal((await db.select().from(relationshipSaves)).length, 1);
    assert.equal((await db.select().from(stateCommitLedger).where(eq(stateCommitLedger.targetKey, relationshipSaveTargetKey("chat-1", "char-1", "persona-1")))).length, 2);
  } finally { cleanup(); }
});

test("Relationship Save explicit authority is immutable and rolls back on rejected commits", async () => {
  const { db, cleanup } = await createTestDatabase();
  try {
    const storage = createRelationshipSavesStorage(db);
    const first = await storage.commit(saveInput());
    assert.equal(first.status, "committed");
    assert.equal((await db.select().from(stateAuthorityRecords)).length, 1);

    const changedReason = saveInput({
      explicitAuthority: {
        actorType: "user", actorId: "local-user", authorityPath: "manual_edit",
        targetKey: relationshipSaveTargetKey("chat-1", "char-1", "persona-1"),
        reason: "rewritten reason", issuedBy: "test", authorizationKey: "save-key-1",
      },
    });
    assert.equal((await storage.commit(changedReason)).status, "idempotency_conflict");

    const stale = saveInput({ idempotencyKey: "stale-authority" });
    const staleResult = await storage.commit(stale);
    assert.deepEqual(staleResult, { status: "revision_conflict", expectedRevision: 0, currentRevision: 1 });
    assert.equal((await db.select().from(stateAuthorityRecords)).length, 1);

    await assert.rejects(
      storage.commit(saveInput({
        baseRevision: 1,
        idempotencyKey: "wrong-target-authority",
        explicitAuthority: {
          actorType: "user", actorId: "local-user", authorityPath: "manual_edit",
          targetKey: relationshipSaveTargetKey("chat-1", "char-1", "persona-other"),
          reason: "wrong target", issuedBy: "test", authorizationKey: "wrong-target-authority",
        },
      })),
      /explicit authority input mismatch/,
    );
    assert.equal((await db.select().from(stateAuthorityRecords)).length, 1);
    assert.equal((await db.select().from(stateCommitLedger)).length, 1);
  } finally { cleanup(); }
});

test("Relationship checkpoint storage fails closed without Phase C scheduler authority", async () => {
  const { db, cleanup } = await createTestDatabase();
  try {
    const storage = createRelationshipSavesStorage(db);
    await assert.rejects(
      storage.createCheckpoint(checkpointInput()),
      /Phase C internal scheduler authority path/,
    );
    assert.equal((await storage.listCheckpoints("chat-1", "char-1", "persona-1")).length, 0);
    assert.equal((await db.select().from(stateTargetHeads)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
  } finally { cleanup(); }
});

test("Relationship Save corruption fails closed without partial ledger or projection writes", async () => {
  const { db, cleanup } = await createTestDatabase();
  try {
    const storage = createRelationshipSavesStorage(db);
    assert.equal((await storage.commit(saveInput())).status, "committed");
    await db.update(relationshipSaves).set({ revision: 99 }).where(eq(relationshipSaves.targetKey, relationshipSaveTargetKey("chat-1", "char-1", "persona-1")));
    await assert.rejects(storage.commit(saveInput({ baseRevision: 1, idempotencyKey: "save-key-2" })), /projection\/head mismatch/);
    assert.equal((await db.select().from(stateCommitLedger)).length, 1);
    assert.equal((await db.select().from(stateTargetHeads))[0]?.revision, 1);
  } finally { cleanup(); }
});
