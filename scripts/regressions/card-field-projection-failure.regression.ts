import assert from "node:assert/strict";
import { characterDataSchema } from "../../packages/shared/src/index.js";
import { getDB, closeDB } from "../../packages/server/src/db/connection.js";
import { characters, chats } from "../../packages/server/src/db/schema/index.js";
import { logger } from "../../packages/server/src/lib/logger.js";
import { resetRateLimitedLogs } from "../../packages/server/src/lib/log-rate-limit.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";

const db = await getDB();
const storage = createCharactersStorage(db);
const timestamp = new Date().toISOString();
const chatId = "projection-failure-chat";
const privateText = "PRIVATE CARD PROSE must never appear in the diagnostic";
const malformedIds = ["projection-invalid-one", "projection-invalid-two"];
const validId = "projection-valid";
const validData = JSON.stringify(
  characterDataSchema.parse({
    name: "Projection control",
    description: "BASE DESCRIPTION",
    extensions: {
      cardFieldAlternatives: [
        { id: "description-alternative", field: "description", value: "CHAT DESCRIPTION", chatIds: [chatId] },
      ],
    },
  }),
);
const debugLines: unknown[][] = [];
const previousDebug = logger.debug;
resetRateLimitedLogs();
logger.debug = ((...args: unknown[]) => debugLines.push(args)) as typeof logger.debug;
try {
  await db
    .insert(characters)
    .values([
      ...malformedIds.map((id) => ({ id, data: privateText, createdAt: timestamp, updatedAt: timestamp })),
      { id: validId, data: validData, createdAt: timestamp, updatedAt: timestamp },
    ]);
  await db.insert(chats).values({
    id: chatId,
    name: "Projection failure proof",
    mode: "roleplay",
    characterIds: JSON.stringify([...malformedIds, validId]),
    metadata: "{}",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  for (const id of malformedIds) {
    const raw = await storage.getById(id);
    assert.ok(raw);
    for (let index = 0; index < 3; index += 1) {
      assert.deepEqual(await storage.getById(id, chatId), raw, "a failed projection preserves the stored row");
    }
  }
  assert.equal(JSON.parse((await storage.getById(validId, chatId))!.data).description, "CHAT DESCRIPTION");
  assert.equal((await storage.getById(validId))!.data, validData, "projection never changes the authored card");

  const failures = debugLines.filter(
    ([fields]) => (fields as { event?: unknown })?.event === "storage.card-field-alternatives",
  );
  assert.equal(failures.length, malformedIds.length, "repeated failures log once per entity in the window");
  assert.deepEqual(
    failures.map(([fields]) => (fields as { entityId: string }).entityId),
    malformedIds,
  );
  for (const [fields] of failures) {
    assert.deepEqual(fields, {
      event: "storage.card-field-alternatives",
      kind: "character",
      entityId: (fields as { entityId: string }).entityId,
      errorCategory: "invalid-json",
      outcome: "failed",
      suppressed: true,
    });
  }
  assert.doesNotMatch(JSON.stringify(failures), /PRIVATE CARD PROSE|BASE DESCRIPTION|CHAT DESCRIPTION/);
  console.info("Card field projection failure fallback, private diagnostics, and per-entity rate limit passed.");
} finally {
  logger.debug = previousDebug;
  resetRateLimitedLogs();
  await closeDB();
}
