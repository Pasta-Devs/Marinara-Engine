import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import type { DB } from "../../../db/connection.js";
import * as schema from "../../../db/schema/index.js";
import { gameEngineState, stateCommitLedger, statePatchProposals, stateTargetHeads } from "../../../db/schema/index.js";
import { GovernedAdapterRegistry } from "../../storage/governed-adapters.js";
import { createGovernedCommitService } from "../../storage/governed-commit.service.js";
import { createGovernedProposalStorage } from "../../storage/governed-proposals.storage.js";
import {
  buildHumanOSRuntimeProposalInput,
  canonicalHumanOSRuntimeProjectionHash,
  humanOSRuntimeTargetIdentity,
} from "../../storage/humanos-runtime-governed.js";
import { humanOSRuntimeParityAdapter } from "../../storage/humanos-runtime-parity.adapter.js";
import { createHumanOSRuntimeStorage } from "../../storage/humanos-runtime.storage.js";

async function createFixture() {
  const tempDir = mkdtempSync(join(tmpdir(), "marinara-humanos-runtime-b1-"));
  const dbPath = join(tempDir, "runtime-b1.db");
  const client = createClient({ url: `file:${dbPath}` });
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
  await client.execute("CREATE UNIQUE INDEX idx_game_engine_state_idempotency ON game_engine_state(idempotency_key) WHERE idempotency_key IS NOT NULL");
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
  await client.execute("CREATE UNIQUE INDEX idx_runtime_b1_proposal_idempotency ON state_patch_proposals(idempotency_key)");
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
  await client.execute("CREATE UNIQUE INDEX idx_runtime_b1_ledger_proposal ON state_commit_ledger(proposal_id)");
  await client.execute("CREATE UNIQUE INDEX idx_runtime_b1_ledger_idempotency ON state_commit_ledger(idempotency_key)");
  return {
    path: dbPath,
    client,
    db: drizzle(client, { schema }) as unknown as DB,
    cleanup() {
      client.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function runtimeInput(overrides: Partial<Parameters<typeof buildHumanOSRuntimeProposalInput>[0]> = {}) {
  return {
    chatId: "chat-1",
    state: JSON.stringify({ trust: 0.25, affinity: 0.5 }),
    baseRevision: 0,
    messageId: "message-1",
    swipeIndex: 0,
    turnId: "turn-1",
    sourceContentHash: createHash("sha256").update("canonical assistant output").digest("hex"),
    idempotencyKey: "runtime-key-1",
    ...overrides,
  };
}

async function seedCanonicalAssistant(db: DB, input = runtimeInput(), content = "canonical assistant output") {
  const createdAt = new Date().toISOString();
  await db.insert(schema.messages).values({
    id: input.messageId,
    chatId: input.chatId,
    role: "assistant",
    content,
    activeSwipeIndex: input.swipeIndex,
    publicationStatus: "canonical",
    publicationTurnId: input.turnId,
    createdAt,
    extra: "{}",
  });
  await db.insert(schema.messageSwipes).values({
    id: `${input.messageId}-swipe-${input.swipeIndex}`,
    messageId: input.messageId,
    index: input.swipeIndex,
    content,
    publicationStatus: "canonical",
    publicationTurnId: input.turnId,
    createdAt,
    extra: "{}",
  });
}

test("Phase B1 canonical Runtime projection hash ignores JSON key order", () => {
  assert.equal(
    canonicalHumanOSRuntimeProjectionHash('{"a":1,"b":2}'),
    canonicalHumanOSRuntimeProjectionHash('{"b":2,"a":1}'),
  );
});

test("Phase B1 malformed Runtime JSON fails before proposal insertion", async () => {
  const { db, cleanup } = await createFixture();
  try {
    assert.throws(() => buildHumanOSRuntimeProposalInput(runtimeInput({ state: "{malformed" })), /Unexpected token|Expected property name/);
    assert.equal((await db.select().from(statePatchProposals)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 invalid Runtime patch shape fails before mutation", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose({
      ...buildHumanOSRuntimeProposalInput(input),
      patch: {
        state: { trust: 0.25 },
        baseRevision: 0,
        compatibility: {
          messageId: input.messageId,
          swipeIndex: input.swipeIndex,
          turnId: input.turnId,
          sourceContentHash: input.sourceContentHash,
          patchType: "humanos-runtime",
          idempotencyKey: input.idempotencyKey,
        },
        unexpected: true,
      },
    });
    await assert.rejects(createGovernedCommitService(db).commitStoredProposal(proposed.row.id), /patch shape/);
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
    assert.equal((await db.select().from(stateTargetHeads)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 rejects Runtime compatibility metadata that does not match canonical evidence", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const base = buildHumanOSRuntimeProposalInput(input);
    const basePatch = base.patch as {
      state: unknown;
      baseRevision: number;
      compatibility: Record<string, unknown>;
    };
    const proposed = await proposals.propose({
      ...base,
      patch: {
        ...basePatch,
        compatibility: {
          ...basePatch.compatibility,
          messageId: "message-2",
        },
      },
    });
    await assert.rejects(
      createGovernedCommitService(db).commitStoredProposal(proposed.row.id),
      /compatibility metadata must match canonical turn evidence/,
    );
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 rejects Runtime proposals whose normalized target disagrees with canonical evidence", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose({
      ...buildHumanOSRuntimeProposalInput(input),
      targetId: "chat-2",
      targetKey: humanOSRuntimeTargetIdentity("chat-2").key,
    });
    await assert.rejects(
      createGovernedCommitService(db).commitStoredProposal(proposed.row.id),
      /authority chat mismatch/,
    );
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 rejects Runtime patches whose baseRevision diverges from the proposal baseRevision", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const base = buildHumanOSRuntimeProposalInput(input);
    const basePatch = base.patch as {
      state: unknown;
      baseRevision: number;
      compatibility: Record<string, unknown>;
    };
    const proposed = await proposals.propose({
      ...base,
      patch: {
        ...basePatch,
        baseRevision: 1,
      },
    });
    await assert.rejects(
      createGovernedCommitService(db).commitStoredProposal(proposed.row.id),
      /patch baseRevision does not match proposal baseRevision/,
    );
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 stale canonical evidence rejects the stored proposal at commit time", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    await db.update(schema.messageSwipes).set({ content: "edited after proposal" }).where(eq(schema.messageSwipes.messageId, input.messageId));

    const result = await createGovernedCommitService(db).commitStoredProposal(proposed.row.id);
    assert.deepEqual(result, { status: "rejected_evidence", reason: "canonical_content_changed" });
    const resolved = await proposals.get(proposed.row.id);
    assert.equal(resolved?.status, "rejected_evidence");
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
  } finally {
    cleanup();
  }
});

test("Phase B1 exact proposal and commit retries produce one Runtime row and one ledger row", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    const replay = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    assert.equal(replay.status, "replayed");
    assert.equal(replay.row.id, first.row.id);

    const service = createGovernedCommitService(db);
    const committed = await service.commitStoredProposal(first.row.id);
    assert.equal(committed.status, "committed");
    const resumed = await service.commitStoredProposal(first.row.id);
    assert.equal(resumed.status, "replayed");
    if (resumed.status === "replayed" && "runtimeRow" in resumed) {
      assert.equal(resumed.runtimeRow?.messageId, input.messageId);
    }

    assert.equal((await db.select().from(gameEngineState)).length, 1);
    assert.equal((await db.select().from(stateCommitLedger)).length, 1);
    const resolved = await proposals.get(first.row.id);
    assert.equal(resolved?.status, "committed");
  } finally {
    cleanup();
  }
});

test("Phase B1 historical committed replay returns the original Runtime row after newer commits", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const firstInput = runtimeInput();
    await seedCanonicalAssistant(db, firstInput);
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(buildHumanOSRuntimeProposalInput(firstInput));
    const service = createGovernedCommitService(db);
    const firstCommit = await service.commitStoredProposal(first.row.id);
    assert.equal(firstCommit.status, "committed");

    const secondInput = runtimeInput({
      messageId: "message-2",
      turnId: "turn-2",
      baseRevision: 1,
      state: JSON.stringify({ trust: 0.5, affinity: 0.7 }),
      sourceContentHash: createHash("sha256").update("canonical assistant output 2").digest("hex"),
      idempotencyKey: "runtime-key-2",
    });
    await seedCanonicalAssistant(db, secondInput, "canonical assistant output 2");
    const second = await proposals.propose(buildHumanOSRuntimeProposalInput(secondInput));
    const secondCommit = await service.commitStoredProposal(second.row.id);
    assert.equal(secondCommit.status, "committed");

    const replay = await service.commitStoredProposal(first.row.id);
    assert.equal(replay.status, "replayed");
    if (replay.status === "replayed" && "runtimeRow" in replay) {
      assert.equal(replay.runtimeRow?.messageId, firstInput.messageId);
      assert.equal(replay.runtimeRow?.turnId, firstInput.turnId);
      assert.equal(replay.runtimeRow?.revision, 1);
    }
    assert.equal((await db.select().from(gameEngineState)).length, 2);
    assert.equal((await db.select().from(stateCommitLedger)).length, 2);
  } finally {
    cleanup();
  }
});

test("Phase B1 replay fails closed when the committed Runtime compatibility row is missing", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    const service = createGovernedCommitService(db);
    assert.equal((await service.commitStoredProposal(first.row.id)).status, "committed");
    await db.delete(gameEngineState).where(eq(gameEngineState.idempotencyKey, first.row.idempotencyKey));
    await assert.rejects(
      service.commitStoredProposal(first.row.id),
      /missing its Runtime compatibility row/,
    );
  } finally {
    cleanup();
  }
});

test("Phase B1 changed proposal retry input conflicts", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(buildHumanOSRuntimeProposalInput(runtimeInput()));
    assert.equal(first.status, "proposed");
    const conflict = await proposals.propose({
      ...buildHumanOSRuntimeProposalInput(runtimeInput()),
      actor: {
        ...buildHumanOSRuntimeProposalInput(runtimeInput()).actor,
        priority: 11,
      },
    });
    assert.equal(conflict.status, "idempotency_conflict");
    assert.equal((await db.select().from(statePatchProposals)).length, 1);
  } finally {
    cleanup();
  }
});

test("Phase B1 stale revision changes nothing", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const first = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    const service = createGovernedCommitService(db);
    assert.equal((await service.commitStoredProposal(first.row.id)).status, "committed");

    const secondInput = runtimeInput({
      messageId: "message-2",
      turnId: "turn-2",
      sourceContentHash: createHash("sha256").update("canonical assistant output 2").digest("hex"),
      idempotencyKey: "runtime-key-2",
    });
    await seedCanonicalAssistant(db, secondInput, "canonical assistant output 2");
    const second = await proposals.propose(buildHumanOSRuntimeProposalInput(secondInput));
    const result = await service.commitStoredProposal(second.row.id);
    assert.deepEqual(result, { status: "revision_conflict", expectedRevision: 0, currentRevision: 1 });
    assert.equal((await db.select().from(gameEngineState)).length, 1);
    assert.equal((await db.select().from(stateCommitLedger)).length, 1);
    assert.equal((await db.select().from(stateTargetHeads)).length, 1);
    assert.equal((await proposals.get(second.row.id))?.status, "revision_conflict");
  } finally {
    cleanup();
  }
});

test("Phase B1 projection persistence failure rolls back proposal, ledger, head, and Runtime row", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    const failingRegistry = new GovernedAdapterRegistry().register({
      ...humanOSRuntimeParityAdapter,
      async persistProjection() { throw new Error("forced projection write failure"); },
    });
    await assert.rejects(
      createGovernedCommitService(db, failingRegistry).commitStoredProposal(proposed.row.id),
      /forced projection write failure/,
    );
    assert.equal((await db.select().from(gameEngineState)).length, 0);
    assert.equal((await db.select().from(stateCommitLedger)).length, 0);
    assert.equal((await db.select().from(stateTargetHeads)).length, 0);
    assert.equal((await proposals.get(proposed.row.id))?.status, "proposed");
  } finally {
    cleanup();
  }
});

test("Phase B1 compatibility Runtime row survives restart and remains readable through the existing API", async () => {
  const { path, db, client, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    const service = createGovernedCommitService(db);
    assert.equal((await service.commitStoredProposal(proposed.row.id)).status, "committed");
    client.close();

    const reopenedClient = createClient({ url: `file:${path}` });
    const reopenedDb = drizzle(reopenedClient, { schema }) as unknown as DB;
    const latest = await createHumanOSRuntimeStorage(reopenedDb).getLatestCommitted(input.chatId);
    assert.equal(latest?.revision, 1);
    assert.equal(latest?.messageId, input.messageId);
    assert.equal(latest?.gameType, "humanos-v2");
    reopenedClient.close();
  } finally {
    cleanup();
  }
});

test("Phase B1 Runtime commit kernel uses canonical governed target identity", async () => {
  const { db, cleanup } = await createFixture();
  try {
    const input = runtimeInput();
    await seedCanonicalAssistant(db, input);
    const proposals = createGovernedProposalStorage(db);
    const proposed = await proposals.propose(buildHumanOSRuntimeProposalInput(input));
    await createGovernedCommitService(db).commitStoredProposal(proposed.row.id);
    const heads = await db.select().from(stateTargetHeads);
    assert.equal(heads[0]?.targetKey, humanOSRuntimeTargetIdentity(input.chatId).key);
  } finally {
    cleanup();
  }
});
