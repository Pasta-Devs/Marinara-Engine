import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { DB } from "../../../db/connection.js";
import { createFileNativeDB } from "../../../db/file-backed-store.js";
import { runMigrations } from "../../../db/migrate.js";
import * as schema from "../../../db/schema/index.js";
import { stateCommitLedger, stateParityVerifications, statePatchProposals, stateTargetHeads } from "../../../db/schema/index.js";
import { canonicalJson, canonicalJsonHash } from "../../storage/canonical-json.js";
import { GovernedAdapterRegistry, type GovernedStateAdapter } from "../../storage/governed-adapters.js";
import { validateCommitEvidence } from "../../storage/governed-evidence.js";
import { createGovernedParityStorage } from "../../storage/governed-parity.storage.js";
import { planGovernedBatch, type PlannableProposal } from "../../storage/governed-planner.js";
import { createGovernedProposalStorage, type StatePatchProposalInput } from "../../storage/governed-proposals.storage.js";

async function createFixture() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-phase-a-"));
  const client = createClient({ url: `file:${join(tempDir, "phase-a.db")}` });
  await client.execute(`CREATE TABLE messages (
    id TEXT PRIMARY KEY NOT NULL, chat_id TEXT NOT NULL, role TEXT NOT NULL,
    character_id TEXT, content TEXT NOT NULL DEFAULT '', active_swipe_index INTEGER NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'canonical', publication_turn_id TEXT,
    promoted_at TEXT, rejected_at TEXT, rejection_reason TEXT, extra TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE message_swipes (
    id TEXT PRIMARY KEY NOT NULL, message_id TEXT NOT NULL, "index" INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '', publication_status TEXT NOT NULL DEFAULT 'canonical', publication_turn_id TEXT,
    promoted_at TEXT, rejected_at TEXT, rejection_reason TEXT, extra TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_authority_records (
    id TEXT PRIMARY KEY NOT NULL, authority_kind TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL, target_key TEXT NOT NULL, reason TEXT NOT NULL, issued_by TEXT NOT NULL,
    authorization_key TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_patch_proposals (
    id TEXT PRIMARY KEY NOT NULL, schema_version INTEGER NOT NULL, target_kind TEXT NOT NULL, target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL, target_key TEXT NOT NULL, operation TEXT NOT NULL, patch_json TEXT NOT NULL,
    patch_hash TEXT NOT NULL, base_revision INTEGER NOT NULL, evidence_kind TEXT NOT NULL, chat_id TEXT, turn_id TEXT,
    message_id TEXT, swipe_index INTEGER, source_content_hash TEXT, canonical_revision INTEGER, authority_record_id TEXT,
    authority_reason TEXT, authority_source_hash TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL, agent_run_id TEXT, pipeline_stage TEXT, writer_priority INTEGER NOT NULL,
    commit_group_id TEXT NOT NULL, dependency_ids_json TEXT NOT NULL DEFAULT '[]', failure_boundary TEXT NOT NULL,
    failure_mode TEXT NOT NULL, logical_patch_slot TEXT NOT NULL, idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed', diagnostic_json TEXT, commit_id TEXT, created_at TEXT NOT NULL, resolved_at TEXT
  )`);
  await client.execute("CREATE UNIQUE INDEX idx_phase_a_proposal_idempotency ON state_patch_proposals(idempotency_key)");
  await client.execute(`CREATE TABLE state_parity_verifications (
    id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT, adapter_kind TEXT NOT NULL, target_key TEXT NOT NULL,
    legacy_hash TEXT NOT NULL, predicted_hash TEXT NOT NULL, matched INTEGER NOT NULL, diagnostic_json TEXT, created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_target_heads (
    target_key TEXT PRIMARY KEY NOT NULL, target_kind TEXT NOT NULL, target_scope TEXT NOT NULL, target_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0, last_commit_id TEXT, state_hash TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE state_commit_ledger (
    id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL, target_key TEXT NOT NULL, target_kind TEXT NOT NULL,
    target_scope TEXT NOT NULL, target_id TEXT NOT NULL, base_revision INTEGER NOT NULL, result_revision INTEGER NOT NULL,
    operation TEXT NOT NULL, patch_json TEXT NOT NULL, patch_hash TEXT NOT NULL, before_hash TEXT NOT NULL,
    result_hash TEXT NOT NULL, evidence_kind TEXT NOT NULL, evidence_chat_id TEXT, evidence_turn_id TEXT,
    evidence_message_id TEXT, evidence_swipe_index INTEGER, evidence_content_hash TEXT, evidence_canonical_revision INTEGER,
    evidence_reason TEXT, evidence_source_hash TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL, authority_record_id TEXT, batch_id TEXT NOT NULL, commit_order INTEGER NOT NULL DEFAULT 0,
    commit_group_id TEXT, dependency_commit_ids TEXT NOT NULL DEFAULT '[]', compensates_commit_id TEXT,
    idempotency_key TEXT NOT NULL, committed_at TEXT NOT NULL
  )`);
  return {
    client,
    db: drizzle(client, { schema }) as unknown as DB,
    cleanup() { client.close(); rmSync(tempDir, { recursive: true, force: true }); },
  };
}

const content = "canonical assistant output";
const contentHash = createHash("sha256").update(content).digest("hex");

function proposalInput(overrides: Partial<StatePatchProposalInput> = {}): StatePatchProposalInput {
  return {
    schemaVersion: 1,
    targetKind: "test_state",
    targetScope: "chat",
    targetId: "chat-1",
    targetKey: "test_state:chat:chat-1",
    operation: "replace",
    patch: { beta: 2, alpha: 1 },
    baseRevision: 0,
    evidence: { kind: "canonical_turn", chatId: "chat-1", turnId: "turn-1", messageId: "message-1", swipeIndex: 0, sourceContentHash: contentHash },
    actor: { type: "agent", id: "agent-1", authorityPath: "canonical_turn", agentRunId: "run-1", pipelineStage: "post_canonical_tracking", priority: 10 },
    commitGroupId: "group-1",
    dependencyIds: [],
    failureBoundary: "target",
    failureMode: "required",
    logicalPatchSlot: "state",
    ...overrides,
  };
}

const adapter: GovernedStateAdapter<Record<string, unknown>, Record<string, unknown>> = {
  targetKind: "test_state", schemaVersion: 1, phaseRank: 0, targetKindRank: 0,
  normalizeTarget: () => ({ kind: "test_state", scope: "chat", id: "chat-1", key: "test_state:chat:chat-1" }),
  normalizePatch: (_operation, input) => JSON.parse(canonicalJson(input)) as Record<string, unknown>,
  validatePolicy: () => undefined,
  loadProjection: async () => null,
  applyPatch: (_current, _operation, patch) => patch,
  validateResult: (_current, result) => { canonicalJson(result); },
  persistProjection: async () => { throw new Error("parity must not persist"); },
  hashProjection: canonicalJsonHash,
};

test("Phase A proposal retries replay exactly and conflicting retry coordinates fail", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(proposalInput());
    assert.equal(first.status, "proposed");
    const replay = await proposals.propose(proposalInput({ patch: { alpha: 1, beta: 2 } }));
    assert.equal(replay.status, "replayed");
    assert.equal(replay.row.id, first.row.id);
    const conflict = await proposals.propose(proposalInput({ baseRevision: 1 }));
    assert.equal(conflict.status, "idempotency_conflict");
    assert.equal((await db.select().from(statePatchProposals)).length, 1);
  } finally { cleanup(); }
});

test("Phase A canonical evidence rejects stale selected swipes and changed content", async () => {
  const { client, db, cleanup } = await createFixture();
  try {
    await client.execute({ sql: "INSERT INTO messages (id, chat_id, role, active_swipe_index, publication_status, publication_turn_id, created_at) VALUES (?, ?, 'assistant', 0, 'canonical', ?, ?)", args: ["message-1", "chat-1", "turn-1", new Date().toISOString()] });
    await client.execute({ sql: "INSERT INTO message_swipes (id, message_id, \"index\", content, publication_status, publication_turn_id, created_at) VALUES (?, ?, 0, ?, 'canonical', ?, ?)", args: ["swipe-1", "message-1", content, "turn-1", new Date().toISOString()] });
    assert.deepEqual(await validateCommitEvidence(db, proposalInput().evidence), { valid: true });
    await client.execute("UPDATE messages SET active_swipe_index = 1 WHERE id = 'message-1'");
    assert.deepEqual(await validateCommitEvidence(db, proposalInput().evidence), { valid: false, reason: "selected_swipe_changed" });
    await client.execute("UPDATE messages SET active_swipe_index = 0 WHERE id = 'message-1'");
    await client.execute("UPDATE message_swipes SET content = 'edited' WHERE id = 'swipe-1'");
    assert.deepEqual(await validateCommitEvidence(db, proposalInput().evidence), { valid: false, reason: "canonical_content_changed" });
  } finally { cleanup(); }
});

test("Phase A planning is deterministic under randomized completion order", () => {
  const registry = new GovernedAdapterRegistry().register(adapter).register({ ...adapter, targetKind: "later_state", phaseRank: 1, targetKindRank: 1 });
  const proposals: PlannableProposal[] = [
    { id: "a", targetKind: "test_state", targetKey: "test_state:chat:a", writerPriority: 20, pipelineStage: "post_canonical_tracking", logicalPatchSlot: "a", patchHash: "a", dependencyIdsJson: "[]", failureBoundary: "target", failureMode: "required" },
    { id: "b", targetKind: "later_state", targetKey: "later_state:chat:b", writerPriority: 10, pipelineStage: "post_canonical_commit", logicalPatchSlot: "b", patchHash: "b", dependencyIdsJson: '["a"]', failureBoundary: "target", failureMode: "required" },
    { id: "c", targetKind: "test_state", targetKey: "test_state:chat:c", writerPriority: 5, pipelineStage: "post_canonical_tracking", logicalPatchSlot: "c", patchHash: "c", dependencyIdsJson: "[]", failureBoundary: "target", failureMode: "optional" },
  ];
  const signature = (input: PlannableProposal[]) => planGovernedBatch(input, registry).flatMap((group) => group.proposals.map((entry) => entry.id)).join(",");
  const expected = signature(proposals);
  for (let index = 0; index < 50; index += 1) assert.equal(signature([...proposals].sort(() => Math.random() - 0.5)), expected);
});

test("Phase A file-native audit records survive flush and restart", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-phase-a-files-"));
  const priorDir = process.env.FILE_STORAGE_DIR;
  process.env.FILE_STORAGE_DIR = tempDir;
  try {
    const first = await createFileNativeDB();
    const db = first as unknown as DB;
    const proposal = await createGovernedProposalStorage(db).propose(proposalInput());
    assert.equal(proposal.status, "proposed");
    await createGovernedParityStorage(db).verify({
      proposalId: proposal.row.id,
      adapter,
      target: { kind: "test_state", scope: "chat", id: "chat-1", key: "test_state:chat:chat-1" },
      operation: "replace",
      patch: { alpha: 1 },
      authority: { evidence: proposalInput().evidence, actor: { type: "agent", id: "agent-1", authorityPath: "canonical_turn" } },
      legacyProjection: { alpha: 1 },
    });
    await first._fileStore.flush();
    await first._fileStore.close();

    const reopened = await createFileNativeDB();
    const reopenedDb = reopened as unknown as DB;
    assert.equal((await reopenedDb.select().from(statePatchProposals)).length, 1);
    assert.equal((await reopenedDb.select().from(stateParityVerifications)).length, 1);
    await reopened._fileStore.close();
  } finally {
    if (priorDir === undefined) delete process.env.FILE_STORAGE_DIR;
    else process.env.FILE_STORAGE_DIR = priorDir;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Phase A legacy SQLite migration adds complete governed evidence columns", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-phase-a-migration-"));
  const client = createClient({ url: `file:${join(tempDir, "upgrade.db")}` });
  try {
    await client.execute(`CREATE TABLE state_commit_ledger (
      id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL, target_key TEXT NOT NULL, target_kind TEXT NOT NULL,
      target_scope TEXT NOT NULL, target_id TEXT NOT NULL, base_revision INTEGER NOT NULL, result_revision INTEGER NOT NULL,
      operation TEXT NOT NULL, patch_json TEXT NOT NULL, patch_hash TEXT NOT NULL, before_hash TEXT NOT NULL,
      result_hash TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, authority_path TEXT NOT NULL,
      batch_id TEXT NOT NULL, commit_order INTEGER NOT NULL DEFAULT 0, commit_group_id TEXT,
      dependency_commit_ids TEXT NOT NULL DEFAULT '[]', compensates_commit_id TEXT, idempotency_key TEXT NOT NULL,
      committed_at TEXT NOT NULL
    )`);
    const db = drizzle(client, { schema }) as unknown as DB;
    await runMigrations(db);
    const columns = await client.execute("PRAGMA table_info(state_commit_ledger)");
    const names = new Set(columns.rows.map((row) => String(row.name)));
    for (const name of ["authority_record_id", "evidence_kind", "evidence_chat_id", "evidence_turn_id", "evidence_message_id", "evidence_swipe_index", "evidence_content_hash", "evidence_canonical_revision", "evidence_reason", "evidence_source_hash"]) assert.ok(names.has(name), `missing migrated column ${name}`);
    for (const table of ["state_patch_proposals", "state_parity_verifications", "state_authority_records", "state_target_heads"]) {
      const result = await client.execute({ sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", args: [table] });
      assert.equal(result.rows.length, 1, `missing migrated table ${table}`);
    }
  } finally {
    client.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Phase A parity changes only parity diagnostics and cannot impersonate authority rows", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const target = { kind: "test_state", scope: "chat", id: "chat-1", key: "test_state:chat:chat-1" };
    const authority = { evidence: proposalInput().evidence, actor: { type: "agent" as const, id: "agent-1", authorityPath: "canonical_turn" as const } };
    const before = {
      proposals: await db.select().from(statePatchProposals),
      heads: await db.select().from(stateTargetHeads),
      commits: await db.select().from(stateCommitLedger),
    };
    const row = await createGovernedParityStorage(db).verify({ adapter, target, operation: "replace", patch: { alpha: 1 }, authority, legacyProjection: { alpha: 1 } });
    assert.equal(row.matched, true);
    assert.deepEqual(await db.select().from(statePatchProposals), before.proposals);
    assert.deepEqual(await db.select().from(stateTargetHeads), before.heads);
    assert.deepEqual(await db.select().from(stateCommitLedger), before.commits);
    const parity = await db.select().from(stateParityVerifications);
    assert.equal(parity.length, 1);
    assert.equal(parity[0]?.id, row.id);
    assert.equal(parity[0]?.proposalId, null);
  } finally { cleanup(); }
});
