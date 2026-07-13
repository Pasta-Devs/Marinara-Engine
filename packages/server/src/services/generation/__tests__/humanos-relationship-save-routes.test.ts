import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Fastify from "fastify";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import type { DB } from "../../../db/connection.js";
import * as schema from "../../../db/schema/index.js";
import { stateAuthorityRecords, stateCommitLedger } from "../../../db/schema/index.js";
import { humanosV2Routes } from "../../../routes/humanos-v2.routes.js";

async function createRouteFixture() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-relationship-routes-"));
  const client = createClient({ url: `file:${join(tempDir, "routes.db")}` });
  await client.execute(`CREATE TABLE chats (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, mode TEXT NOT NULL,
    character_ids TEXT NOT NULL DEFAULT '[]', group_id TEXT, persona_id TEXT,
    prompt_preset_id TEXT, connection_id TEXT, metadata TEXT NOT NULL DEFAULT '{}',
    connected_chat_id TEXT, folder_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE messages (
    id TEXT PRIMARY KEY NOT NULL, chat_id TEXT NOT NULL, role TEXT NOT NULL,
    character_id TEXT, content TEXT NOT NULL DEFAULT '', active_swipe_index INTEGER NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'canonical', publication_turn_id TEXT,
    promoted_at TEXT, rejected_at TEXT, rejection_reason TEXT, extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE game_engine_state (
    id TEXT PRIMARY KEY NOT NULL, chat_id TEXT NOT NULL, message_id TEXT NOT NULL DEFAULT '',
    swipe_index INTEGER NOT NULL DEFAULT 0, game_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL,
    committed INTEGER NOT NULL DEFAULT 0, revision INTEGER, base_revision INTEGER,
    turn_id TEXT, source_content_hash TEXT, patch_type TEXT, idempotency_key TEXT,
    created_at TEXT NOT NULL
  )`);
  await client.execute(
    "CREATE UNIQUE INDEX idx_route_runtime_idempotency ON game_engine_state(idempotency_key) WHERE idempotency_key IS NOT NULL",
  );
  await client.execute(`CREATE TABLE state_authority_records (
    id TEXT PRIMARY KEY NOT NULL, authority_kind TEXT NOT NULL, actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL, authority_path TEXT NOT NULL, target_key TEXT NOT NULL,
    reason TEXT NOT NULL, issued_by TEXT NOT NULL, authorization_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_route_authority_key ON state_authority_records(authorization_key)");
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
  await client.execute("CREATE UNIQUE INDEX idx_route_ledger_proposal ON state_commit_ledger(proposal_id)");
  await client.execute("CREATE UNIQUE INDEX idx_route_ledger_idempotency ON state_commit_ledger(idempotency_key)");
  await client.execute(`CREATE TABLE relationship_saves (
    id TEXT PRIMARY KEY NOT NULL, target_key TEXT NOT NULL, chat_id TEXT NOT NULL,
    character_id TEXT NOT NULL, persona_id TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT '{}',
    active_truth_count INTEGER NOT NULL DEFAULT 0, milestone_count INTEGER NOT NULL DEFAULT 0,
    last_checkpoint_id TEXT, projection_hash TEXT NOT NULL DEFAULT '', source_commit_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_route_relationship_target ON relationship_saves(target_key)");
  await client.execute(`CREATE TABLE relationship_checkpoints (
    id TEXT PRIMARY KEY NOT NULL, relationship_save_id TEXT NOT NULL, target_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL,
    canonical_message_count INTEGER NOT NULL, start_message_id TEXT NOT NULL, end_message_id TEXT NOT NULL,
    message_hashes TEXT NOT NULL DEFAULT '[]', previous_checkpoint_id TEXT, policy_version TEXT NOT NULL,
    character_truth_tokens INTEGER NOT NULL DEFAULT 0, active_state TEXT NOT NULL DEFAULT '{}',
    classifications TEXT NOT NULL DEFAULT '[]', source_commit_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'valid', creation_reason TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const db = drizzle(client, { schema }) as unknown as DB;
  const app = Fastify({ logger: false });
  app.decorate("db", db);
  await app.register(humanosV2Routes, { prefix: "/api/humanos-v2" });
  await app.ready();
  return {
    app,
    db,
    client,
    async cleanup() {
      await app.close();
      client.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function seedMessages(client: ReturnType<typeof createClient>) {
  await client.execute({
    sql: "INSERT INTO chats (id,name,mode,created_at,updated_at) VALUES (?,?,?,?,?)",
    args: ["chat-1", "Chat", "roleplay", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
  });
  const insert = "INSERT INTO messages (id,chat_id,role,content,active_swipe_index,publication_status,created_at) VALUES (?,?,?,?,?,?,?)";
  await client.execute({ sql: insert, args: ["assistant-old", "chat-1", "assistant", "old", 0, "canonical", "2026-01-01T00:00:01.000Z"] });
  await client.execute({ sql: insert, args: ["assistant-candidate", "chat-1", "assistant", "draft", 7, "candidate", "2026-01-01T00:00:03.000Z"] });
  await client.execute({ sql: insert, args: ["assistant-canonical", "chat-1", "assistant", "approved", 2, "canonical", "2026-01-01T00:00:02.000Z"] });
}

const saveUrl = "/api/humanos-v2/relationship-save/chat-1/char-1/persona-1";
const validBody = { state: { trust: 3 }, activeTruthCount: 2, milestoneCount: 1 };

test("HumanOS Runtime HTTP blocks public commit-coordinate and authority impersonation", async () => {
  const fixture = await createRouteFixture();
  try {
    await seedMessages(fixture.client);
    const response = await fixture.app.inject({
      method: "PUT",
      url: "/api/humanos-v2/runtime/chat-1",
      payload: {
        state: { trust: 1 },
        committed: true,
        messageId: "assistant-canonical",
        swipeIndex: 2,
        baseRevision: 0,
        revision: 0,
        turnId: "forged-turn",
        sourceContentHash: "a".repeat(64),
        patchType: "humanos-runtime",
        idempotencyKey: "forged-key",
        actorType: "agent",
        actorId: "humanos-runtime-updater",
        authorityPath: "canonical-tool:humanos_commit_runtime",
        commitOrder: 0,
      },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "HUMANOS_RUNTIME_SERVER_AUTHORITY_REQUIRED");
    const projections = await fixture.client.execute("SELECT * FROM game_engine_state");
    assert.equal(projections.rows.length, 0);
    assert.equal((await fixture.db.select().from(stateCommitLedger)).length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("Relationship Save HTTP rejects client-authored commit coordinates and authority evidence", async () => {
  const fixture = await createRouteFixture();
  try {
    await seedMessages(fixture.client);
    for (const forbidden of [
      { baseRevision: 0 },
      { revision: 0 },
      { proposalId: "forged-proposal" },
      { committed: true },
      { evidenceMessageId: "assistant-old" },
      { evidenceSwipeIndex: 0 },
      { evidenceContentHash: "a".repeat(64) },
      { actorType: "system" },
      { actorId: "relationship-checkpoint-writer" },
      { authorityPath: "derived-job:relationship-checkpoint" },
      { authorityRecordId: "forged-authority" },
      { explicitAuthority: { actorType: "administrator" } },
      { idempotencyKey: "client-key" },
      { commitOrder: 99 },
      { dependencyCommitIds: ["fake"] },
    ]) {
      const response = await fixture.app.inject({ method: "PUT", url: saveUrl, payload: { ...validBody, ...forbidden } });
      assert.equal(response.statusCode, 400, JSON.stringify(forbidden));
    }
    assert.equal((await fixture.db.select().from(stateCommitLedger)).length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("Relationship Save HTTP derives canonical evidence, revision, authority, and replay identity server-side", async () => {
  const fixture = await createRouteFixture();
  try {
    await seedMessages(fixture.client);
    const first = await fixture.app.inject({ method: "PUT", url: saveUrl, payload: validBody });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().revision, 1);
    assert.equal(first.json().idempotentReplay, false);

    const ledger = (await fixture.db.select().from(stateCommitLedger))[0]!;
    assert.equal(ledger.baseRevision, 0);
    assert.equal(ledger.evidenceKind, "manual_edit");
    assert.equal(ledger.evidenceChatId, "chat-1");
    assert.equal(ledger.evidenceMessageId, null);
    assert.equal(ledger.evidenceSwipeIndex, null);
    assert.equal(ledger.evidenceContentHash, null);
    assert.equal(ledger.evidenceReason, "Manual Relationship Save update");
    assert.equal(ledger.evidenceSourceHash, createHash("sha256").update("approved").digest("hex"));
    assert.equal(ledger.actorType, "user");
    assert.equal(ledger.actorId, "local-user");
    assert.equal(ledger.authorityPath, "manual_edit");
    assert.ok(ledger.authorityRecordId);
    const authority = (await fixture.db.select().from(stateAuthorityRecords))[0]!;
    assert.equal(authority.id, ledger.authorityRecordId);
    assert.equal(authority.authorityKind, "explicit");
    assert.equal(authority.actorType, "user");
    assert.equal(authority.actorId, "local-user");
    assert.equal(authority.authorityPath, "manual_edit");
    assert.equal(authority.targetKey, "relationship_save:chat-1:char-1:persona-1");
    assert.equal(authority.reason, "Manual Relationship Save update");
    assert.equal(authority.issuedBy, "humanos-v2-http");
    assert.equal(ledger.commitOrder, 0);
    assert.equal(ledger.dependencyCommitIds, "[]");

    const replay = await fixture.app.inject({ method: "PUT", url: saveUrl, payload: validBody });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.json().idempotentReplay, true);
    assert.equal((await fixture.db.select().from(stateCommitLedger)).length, 1);
    assert.equal((await fixture.db.select().from(stateAuthorityRecords)).length, 1);

    const changed = await fixture.app.inject({ method: "PUT", url: saveUrl, payload: { ...validBody, state: { trust: 4 } } });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().revision, 2);
    const ledgers = await fixture.db.select().from(stateCommitLedger);
    assert.deepEqual(ledgers.map((row) => row.baseRevision).sort(), [0, 1]);
  } finally {
    await fixture.cleanup();
  }
});

test("Relationship Save HTTP fails without canonical assistant evidence and blocks public checkpoint authority", async () => {
  const fixture = await createRouteFixture();
  try {
    await fixture.client.execute({
      sql: "INSERT INTO chats (id,name,mode,created_at,updated_at) VALUES (?,?,?,?,?)",
      args: ["chat-1", "Chat", "roleplay", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
    });
    const save = await fixture.app.inject({ method: "PUT", url: saveUrl, payload: validBody });
    assert.equal(save.statusCode, 409);
    assert.equal(save.json().error, "RELATIONSHIP_SAVE_CANONICAL_EVIDENCE_UNAVAILABLE");

    const checkpoint = await fixture.app.inject({
      method: "POST",
      url: `${saveUrl}/checkpoint`,
      payload: {
        revision: 0,
        sourceCommitIds: ["forged"],
        creationReason: "client-authored-system-evidence",
      },
    });
    assert.equal(checkpoint.statusCode, 403);
    assert.equal(checkpoint.json().error, "RELATIONSHIP_CHECKPOINT_SERVER_AUTHORITY_REQUIRED");
    assert.equal((await fixture.db.select().from(stateCommitLedger).where(eq(stateCommitLedger.targetKind, "relationship_checkpoint"))).length, 0);
  } finally {
    await fixture.cleanup();
  }
});
