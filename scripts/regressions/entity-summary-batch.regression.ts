import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterData } from "../../packages/shared/src/index.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import {
  entitySummaryBatchItems,
  entitySummaryBatches,
} from "../../packages/server/src/db/schema/entity-summary-batches.js";
import { EntitySummaryBatchService } from "../../packages/server/src/services/entity-summary/entity-summary-batch.service.js";
import { createEntitySummaryBatchStorage } from "../../packages/server/src/services/entity-summary/entity-summary-batch.storage.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";

async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 3_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for entity summary batch state");
}

const storageDir = mkdtempSync(join(tmpdir(), "marinara-entity-summary-batch-"));
process.env.FILE_STORAGE_DIR = storageDir;

try {
  let db = await createFileNativeDB();
  const characters = createCharactersStorage(db);
  const character = await characters.create({
    name: "Resumable Hero",
    description: "Original source",
  } as CharacterData);
  assert.ok(character);

  let releaseGeneration: (() => void) | null = null;
  let failNext = false;
  let blockUntilCancelled = false;
  const service = new EntitySummaryBatchService(db, async ({ item, signal }) => {
    if (failNext) {
      failNext = false;
      throw new Error("Injected provider failure");
    }
    if (blockUntilCancelled) {
      blockUntilCancelled = false;
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    if (releaseGeneration) {
      await new Promise<void>((resolve, reject) => {
        const release = releaseGeneration;
        releaseGeneration = () => {
          release?.();
          resolve();
        };
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    return { summary: `Candidate for ${item.entityId}`, connectionId: "fake-agent-default" };
  });
  await service.start();

  // An SSE-style subscriber may disconnect without affecting durable execution.
  releaseGeneration = () => {};
  const disconnected = await service.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  const unsubscribe = service.subscribe(disconnected.id, () => undefined);
  unsubscribe();
  releaseGeneration?.();
  releaseGeneration = null;
  const candidate = await waitFor(
    () => service.get(disconnected.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );
  assert.equal(candidate?.status, "completed");
  assert.equal((JSON.parse((await characters.getById(character.id))!.data).extensions ?? {}).entitySummary, undefined);

  // A manual summary edit after generation makes the candidate stale at transactional apply.
  await characters.update(character.id, {
    extensions: {
      entitySummary: "Manual summary",
      entitySummarySource: "manual",
      entitySummaryGeneratedAt: new Date().toISOString(),
    },
  });
  assert.equal(await service.apply(disconnected.id, candidate!.items[0]!.id), "stale");
  const manuallyProtected = JSON.parse((await characters.getById(character.id))!.data);
  assert.equal(manuallyProtected.extensions.entitySummary, "Manual summary");

  // Stale and failed items can be retried, and explicit apply writes the reviewed candidate.
  assert.equal(await service.retry(disconnected.id, candidate!.items[0]!.id), "requeued");
  const regenerated = await waitFor(
    () => service.get(disconnected.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );
  assert.equal(await service.apply(disconnected.id, regenerated!.items[0]!.id), "applied");
  const applied = JSON.parse((await characters.getById(character.id))!.data);
  assert.equal(applied.extensions.entitySummary, `Candidate for ${character.id}`);
  assert.equal(applied.extensions.entitySummarySource, "ai");

  const sourceChanged = await service.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  const sourceChangedCandidate = await waitFor(
    () => service.get(sourceChanged.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );
  await characters.update(character.id, { description: "Source changed after generation" });
  assert.equal(await service.apply(sourceChanged.id, sourceChangedCandidate!.items[0]!.id), "stale");
  assert.equal(
    JSON.parse((await characters.getById(character.id))!.data).extensions.entitySummary,
    applied.extensions.entitySummary,
  );

  failNext = true;
  const failed = await service.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  const failedState = await waitFor(
    () => service.get(failed.id),
    (batch) => batch?.items[0]?.status === "failed",
  );
  assert.match(failedState!.items[0]!.error ?? "", /Injected provider failure/u);
  assert.equal(await service.retry(failed.id, failedState!.items[0]!.id), "requeued");
  await waitFor(
    () => service.get(failed.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );

  blockUntilCancelled = true;
  const cancelled = await service.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  await waitFor(
    () => service.get(cancelled.id),
    (batch) => batch?.items[0]?.status === "running",
  );
  assert.equal(await service.cancel(cancelled.id), true);
  const cancelledState = await waitFor(
    () => service.get(cancelled.id),
    (batch) => batch?.items[0]?.status === "cancelled",
  );
  assert.equal(cancelledState?.status, "cancelled");

  // Cancelling and immediately retrying cannot let the aborted attempt overwrite the retry.
  blockUntilCancelled = true;
  const immediateRetry = await service.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  const immediateRunning = await waitFor(
    () => service.get(immediateRetry.id),
    (batch) => batch?.items[0]?.status === "running",
  );
  assert.equal(await service.cancel(immediateRetry.id), true);
  assert.equal(await service.retry(immediateRetry.id, immediateRunning!.items[0]!.id), "requeued");
  const immediateCandidate = await waitFor(
    () => service.get(immediateRetry.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );
  assert.equal(immediateCandidate!.items[0]!.attempts, 2);
  assert.equal(immediateCandidate!.status, "completed");

  await service.stop();

  // Simulate a process dying after the durable running transition, then reconcile on startup.
  const rawStorage = createEntitySummaryBatchStorage(db);
  const interrupted = await rawStorage.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  await rawStorage.markRunning(interrupted.id, interrupted.items[0]!.id);
  await db._fileStore.flush();
  await db._fileStore.close();
  db = await createFileNativeDB();
  const recoveredService = new EntitySummaryBatchService(db, async ({ item }) => ({
    summary: `Recovered ${item.entityId}`,
    connectionId: "fake-agent-default",
  }));
  await recoveredService.start();
  const recovered = await waitFor(
    () => recoveredService.get(interrupted.id),
    (batch) => batch?.items[0]?.status === "candidate",
  );
  assert.equal(recovered!.items[0]!.attempts, 2);
  assert.match(recovered!.items[0]!.candidateSummary ?? "", /^Recovered/u);
  await recoveredService.stop();

  // Simulate a crash after the candidate was durable but before the old separate batch settlement.
  const candidateCrashStorage = createEntitySummaryBatchStorage(db);
  const candidateCrash = await candidateCrashStorage.create({
    items: [{ kind: "character", entityId: character.id }],
    timeoutMs: 5_000,
    debugMode: false,
  });
  const candidateCrashItem = candidateCrash.items[0]!;
  await candidateCrashStorage.markRunning(candidateCrash.id, candidateCrashItem.id);
  await db.transaction(async (tx) => {
    await tx
      .update(entitySummaryBatchItems)
      .set({ status: "candidate", candidateSummary: "Durable candidate before crash" })
      .where(eq(entitySummaryBatchItems.id, candidateCrashItem.id));
    await tx
      .update(entitySummaryBatches)
      .set({ status: "running", completedAt: null })
      .where(eq(entitySummaryBatches.id, candidateCrash.id));
  });
  await db._fileStore.flush();
  await db._fileStore.close();
  db = await createFileNativeDB();
  const candidateRecoveryService = new EntitySummaryBatchService(db, async () => {
    throw new Error("Terminal candidate must not be generated again");
  });
  await candidateRecoveryService.start();
  const candidateRecovered = await candidateRecoveryService.get(candidateCrash.id);
  assert.equal(candidateRecovered?.items[0]?.status, "candidate");
  assert.equal(candidateRecovered?.status, "completed");
  await candidateRecoveryService.stop();
  await db._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

console.info("Entity summary batch persistence and transition regression checks passed.");
