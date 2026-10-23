import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const startedAt = performance.now();
const reportStage = (stage: string) =>
  console.info(`Chat request validation: ${stage} (${Math.round(performance.now() - startedAt)}ms elapsed)`);
const dataDir = await mkdtemp(join(tmpdir(), "marinara-chat-request-validation-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../packages/server/node_modules/@fastify/multipart/index.js");
const { createChatSchema } = await import("../../packages/shared/dist/index.js");
const { z } = await import("../../packages/server/node_modules/zod/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { importRoutes } = await import("../../packages/server/src/routes/import.routes.js");
const { CHAT_REQUEST_BODY_LIMIT, chatResourceRequestOptions } =
  await import("../../packages/server/src/routes/chat-request-validation.js");

const app = Fastify({ bodyLimit: 256 * 1024 * 1024 });
app.decorate("db", await getDB());
app.setErrorHandler(errorHandler);
await app.register(multipart);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(charactersRoutes, { prefix: "/api/characters" });
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
await app.register(importRoutes, { prefix: "/api/import" });
// Avoid storage work for this large valid-roster control; exercise the same hook and schema.
app.post("/valid-roster-control", chatResourceRequestOptions, (req) => createChatSchema.parse(req.body));
app.post("/validation-detail-control", (req) => z.array(z.string()).parse(req.body));

const element = createChatSchema.shape.characterIds.removeDefault().element;
const parseElement = element._parse;
let elementVisits = 0;
element._parse = function (...args: Parameters<typeof parseElement>) {
  elementVisits++;
  return parseElement.apply(this, args);
};
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

try {
  const created = await app.inject({
    method: "POST",
    url: "/api/chats",
    payload: { name: "Validation", mode: "roleplay" },
  });
  assert.equal(created.statusCode, 200, created.body);
  const chatId = created.json().id;
  const updated = await app.inject({ method: "PATCH", url: `/api/chats/${chatId}`, payload: { name: "Updated" } });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().name, "Updated");

  for (const shape of ["all-invalid", "first-invalid", "last-invalid"]) {
    const invalidIndex = shape === "last-invalid" ? 9_999 : 0;
    const characterIds: unknown[] = Array.from({ length: 10_000 }, (_, i) =>
      shape === "all-invalid" ? null : `character-${i}`,
    );
    characterIds[invalidIndex] = null;
    for (const method of ["POST", "PATCH"] as const) {
      elementVisits = 0;
      const response = await app.inject({
        method,
        url: method === "POST" ? "/api/chats" : `/api/chats/${chatId}`,
        payload: { name: "Malformed roster", mode: "roleplay", characterIds },
      });
      assert.equal(response.statusCode, 400, response.body);
      assert.equal(elementVisits, 0, "both real controllers reject before Zod visits any roster element");
      assert.deepEqual(response.json().details, [
        { path: `characterIds.${invalidIndex}`, message: "Each character ID must be a string." },
      ]);
    }
  }

  elementVisits = 0;
  const validIds = Array.from({ length: 10_001 }, (_, i) => `character-${i}`);
  const valid = await app.inject({
    method: "POST",
    url: "/valid-roster-control",
    payload: { name: "Large valid roster", mode: "roleplay", characterIds: validIds },
  });
  assert.equal(valid.statusCode, 200, valid.body);
  assert.deepEqual(valid.json().characterIds, validIds, "valid rosters have no new count cap");
  assert.equal(elementVisits, validIds.length);

  for (const method of ["POST", "PATCH"] as const) {
    const oversized = await app.inject({
      method,
      url: method === "POST" ? "/api/chats" : `/api/chats/${chatId}`,
      payload: { name: "Oversized resource request", mode: "roleplay", ignored: "x".repeat(CHAT_REQUEST_BODY_LIMIT) },
    });
    assert.equal(oversized.statusCode, 413, "the body budget applies to both ordinary resource endpoints");
  }

  const diagnostics = await app.inject({
    method: "POST",
    url: "/validation-detail-control",
    payload: Array(10_000).fill(null),
  });
  assert.equal(diagnostics.statusCode, 400);
  assert.equal(diagnostics.json().details.length, 50, "other schema errors have bounded public diagnostics");
  assert.ok(diagnostics.rawPayload.length < 10_000);
  reportStage("ordinary resource and bounded diagnostic controls passed");

  // Real native JSON import/export retains user text well beyond the resource budget.
  const description = "Large user-authored text: zażółć gęślą jaźń 🎲\n".repeat(100_000);
  const importedCharacter = await app.inject({
    method: "POST",
    url: "/api/import/marinara",
    payload: {
      type: "marinara_character",
      version: 1,
      data: { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Large transfer", description } },
    },
  });
  assert.equal(importedCharacter.statusCode, 200, importedCharacter.body);
  assert.equal(importedCharacter.json().success, true);
  const exportedCharacter = await app.inject({
    method: "GET",
    url: `/api/characters/${importedCharacter.json().id}/export`,
  });
  assert.equal(exportedCharacter.statusCode, 200, exportedCharacter.body.slice(0, 200));
  assert.ok(exportedCharacter.rawPayload.length > CHAT_REQUEST_BODY_LIMIT);
  assert.equal(hash(exportedCharacter.json().data.data.description), hash(description));
  reportStage("large native character JSON round trip passed");

  // The same large native file also round-trips through the multipart package path.
  const boundary = "marinara-chat-validation-transfer";
  const importedFile = await app.inject({
    method: "POST",
    url: "/api/import/marinara-package",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.marinara.json"\r\nContent-Type: application/json\r\n\r\n`,
      ),
      exportedCharacter.rawPayload,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(importedFile.statusCode, 200, importedFile.body);
  assert.equal(importedFile.json().success, true);
  const reExportedCharacter = await app.inject({
    method: "GET",
    url: `/api/characters/${importedFile.json().id}/export`,
  });
  assert.equal(reExportedCharacter.statusCode, 200);
  assert.equal(hash(reExportedCharacter.json().data.data.description), hash(description));
  reportStage("large native character multipart round trip passed");

  // A separate high-cardinality transfer proves that no ordinary-roster budget leaks into collections.
  const entries = Array.from({ length: 10_001 }, (_, i) => ({
    name: `Entry ${i}`,
    content: `Preserved ${i}: ${"lore ".repeat(30)}`,
    keys: [`key-${i}`],
    order: i,
  }));
  const importedLorebook = await app.inject({
    method: "POST",
    url: "/api/import/marinara",
    payload: { type: "marinara_lorebook", version: 1, data: { lorebook: { name: "Large collection" }, entries } },
  });
  assert.equal(importedLorebook.statusCode, 200, importedLorebook.body);
  assert.equal(importedLorebook.json().success, true);
  const exportedLorebook = await app.inject({
    method: "GET",
    url: `/api/lorebooks/${importedLorebook.json().id}/export`,
  });
  assert.equal(exportedLorebook.statusCode, 200, exportedLorebook.body.slice(0, 200));
  const exportedEntries = exportedLorebook.json().data.entries as Array<{ name: string; content: string }>;
  assert.equal(exportedEntries.length, entries.length);
  assert.deepEqual(
    new Map(exportedEntries.map((e) => [e.name, e.content])),
    new Map(entries.map((e) => [e.name, e.content])),
  );
  reportStage("10,001-entry native lorebook round trip passed");
  console.info("Chat request validation and large transfer regression passed", {
    characterExportBytes: exportedCharacter.rawPayload.length,
    lorebookExportBytes: exportedLorebook.rawPayload.length,
    lorebookEntries: exportedEntries.length,
    validRosterIds: validIds.length,
  });
} finally {
  element._parse = parseElement;
  await app.close();
  await closeDB();
  await rm(dataDir, { recursive: true, force: true });
}
