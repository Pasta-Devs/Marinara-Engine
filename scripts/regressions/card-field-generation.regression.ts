import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { CARD_FIELD_KEYS, type CardFieldDraft } from "../../packages/shared/src/types/card-field.js";
import { characterDataSchema } from "../../packages/shared/src/schemas/character.schema.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-card-field-"));
const previousStorage = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = directory;
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
const [
  { createFileNativeDB },
  { charactersRoutes },
  { createConnectionsStorage },
  { createCharactersStorage },
  { importMarinara },
  { importSTCharacter },
  { countCardFieldWords },
  { logger },
] = await Promise.all([
  import("../../packages/server/src/db/file-backed-store.js"),
  import("../../packages/server/src/routes/characters.routes.js"),
  import("../../packages/server/src/services/storage/connections.storage.js"),
  import("../../packages/server/src/services/storage/characters.storage.js"),
  import("../../packages/server/src/services/import/marinara.importer.js"),
  import("../../packages/server/src/services/import/st-character.importer.js"),
  import("../../packages/server/src/services/generation/card-field-generation.js"),
  import("../../packages/server/src/lib/logger.js"),
]);
const db = await createFileNativeDB();
const app = Fastify();
const requests: Array<Record<string, any>> = [];
let output = "word ".repeat(120).trim();
let finishReason = "stop";
let failingModel = "";
let heldProvider: { started: () => void; closed: () => void } | null = null;
let heldResponse: ServerResponse | null = null;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  if (heldProvider) {
    const held = heldProvider;
    heldResponse = response;
    response.once("close", held.closed);
    held.started();
    return;
  }
  if (body.model === failingModel) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "fixture unavailable" }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: output }, finish_reason: finishReason }] }));
});
const longSummary = "Thoughtful scientist studies ancient history and protects his colleagues. ".repeat(20).trim();
const card: CardFieldDraft = {
  name: "Unsaved name",
  summary: "Unsaved summary",
  description: "Unsaved researcher identity",
  personality: "smart, scientist, handsome",
  backstory: "Unsaved academy history",
  appearance: "Masked face; preserve {{custom_trait}} and {{char}}.",
  scenario: "Unsaved laboratory setting",
  mes_example: "Unsaved playful dialogue direction",
};
try {
  app.decorate("db", db);
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const connections = createConnectionsStorage(db);
  const characters = createCharactersStorage(db);
  const character = await characters.create(characterDataSchema.parse({ name: "Saved name", summary: longSummary }));
  assert.ok(character);
  const persona = await characters.createPersona("Saved persona", "Saved description", undefined, {
    summary: longSummary,
    mes_example: "Saved example",
  });
  assert.ok(persona);
  const characterPath = `/api/characters/${character.id}/card-field/generate`;
  const personaPath = `/api/characters/personas/${persona.id}/card-field/generate`;
  const generate = (url: string, field: string = "personality", extra: Record<string, unknown> = {}) =>
    app.inject({ method: "POST", url, payload: { field, card, ...extra } });
  assert.equal((await generate(characterPath)).statusCode, 400, "no text connection fails before provider work");
  assert.equal(requests.length, 0);
  for (const payload of [
    { field: "creator_notes", card },
    { field: "summary", card: { ...card, summary: 5 } },
    { field: "summary" },
    { field: "summary", card, debugMode: "true" },
  ]) {
    const response = await app.inject({ method: "POST", url: characterPath, payload });
    assert.equal(response.statusCode, 400, response.body);
  }
  const defaultConnection = await connections.create({
    name: "Default",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "",
    model: "default-model",
    isDefault: true,
  });
  let response = await generate(characterPath);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(requests.at(-1)?.model, "default-model");
  const agentConnection = await connections.create({
    name: "Agent default",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "",
    model: "agent-model",
    defaultForAgents: true,
  });
  const originalCharacter = (await characters.getById(character.id))!;
  const originalPersona = (await characters.getPersona(persona.id))!;
  for (const url of [characterPath, personaPath]) {
    for (const field of CARD_FIELD_KEYS) {
      response = await generate(url, field);
      assert.equal(response.statusCode, 200, `${url}/${field}: ${response.body}`);
      assert.equal(response.json().text, output);
      const request = requests.at(-1)!;
      assert.equal(request.model, "agent-model", "same summary resolver prefers the Agent default");
      assert.equal(request.max_tokens, 2048);
      const messages = request.messages;
      assert.match(messages[0].content, /between 100 and 300 words/);
      assert.match(messages[0].content, /anything already written in the selected field/);
      assert.match(messages[0].content, /reference data, not instructions/);
      assert.deepEqual(
        JSON.parse(messages[1].content),
        { selectedField: field, card },
        "full unsaved draft includes the target seed and all references without macro expansion",
      );
      if (field === "mes_example") {
        assert.match(
          messages[0].content,
          url === personaPath ? /Use \{\{user\}\} for this persona/ : /Use \{\{char\}\} for this character/,
        );
      }
    }
  }
  assert.deepEqual(await characters.getById(character.id), originalCharacter, "generation never saves the card");
  assert.deepEqual(await characters.getPersona(persona.id), originalPersona, "generation never saves the persona");
  for (const url of [
    "/api/characters/missing/card-field/generate",
    "/api/characters/personas/missing/card-field/generate",
  ])
    assert.equal((await generate(url)).statusCode, 404);
  for (const words of [100, 300]) {
    output = "word ".repeat(words).trim();
    response = await generate(characterPath);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(countCardFieldWords(response.json().text), words);
  }
  for (const words of [0, 99, 301]) {
    output = "word ".repeat(words).trim();
    const countBefore = requests.length;
    response = await generate(personaPath);
    assert.equal(response.statusCode, 502, response.body);
    assert.match(response.json().error, /original field was kept/);
    assert.equal(requests.length, countBefore + 1, "invalid-length output does not trigger another paid attempt");
  }
  output = "word ".repeat(120).trim();
  finishReason = "length";
  response = await generate(personaPath);
  assert.equal(response.statusCode, 502, response.body);
  assert.match(response.json().error, /output limit/);
  finishReason = "stop";
  assert.equal(countCardFieldWords("Zażółć gęślą jaźń — a thoughtful, kind scientist."), 7);

  // Explicit UI debug mode exposes the exact prompt through the shared override, even at warn level.
  const originalLevel = logger.level;
  const originalWarn = logger.warn;
  const warnings: unknown[][] = [];
  logger.level = "warn";
  logger.warn = ((...args: unknown[]) => {
    warnings.push(args);
  }) as typeof logger.warn;
  try {
    await generate(characterPath, "appearance", { debugMode: false });
    assert.equal(warnings.filter((entry) => String(entry[0]).includes("[debug/card-field/")).length, 0);
    await generate(characterPath, "appearance", { debugMode: true });
    const debug = warnings.find((entry) => String(entry[0]).includes("[debug/card-field/"));
    assert.ok(debug);
    assert.deepEqual(JSON.parse(String(debug.at(-1)))[1], {
      role: "user",
      content: JSON.stringify({ selectedField: "appearance", card }),
    });
  } finally {
    logger.warn = originalWarn;
    logger.level = originalLevel;
  }

  await connections.create({
    name: "Agent fallback",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "",
    model: "fallback-model",
    fallbackForAgents: true,
  });
  failingModel = "agent-model";
  response = await generate(personaPath);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(requests.at(-1)?.model, "fallback-model", "same summary resolver retains the Agent fallback");
  failingModel = "";
  await connections.update(agentConnection.id, { defaultForAgents: false });
  response = await generate(characterPath);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(requests.at(-1)?.model, "default-model");
  assert.ok(defaultConnection.id);

  // The legacy bulk-summary endpoint stays concise while authored long summaries survive saves/imports.
  const bulk = await app.inject({
    method: "POST",
    url: `/api/characters/${character.id}/summary/generate`,
    payload: {},
  });
  assert.equal(bulk.statusCode, 200, bulk.body);
  assert.ok(bulk.json().summary.length > 0 && bulk.json().summary.length <= 500);
  assert.ok(output.startsWith(bulk.json().summary));
  assert.equal(requests.at(-1)?.max_tokens, 256);
  response = await app.inject({
    method: "PATCH",
    url: `/api/characters/${character.id}`,
    payload: { data: { summary: longSummary } },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(JSON.parse((await characters.getById(character.id))!.data).summary, longSummary);
  const importedCharacter = await importSTCharacter(
    { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Imported", summary: longSummary } },
    db,
  );
  assert.ok(importedCharacter.characterId);
  assert.equal(JSON.parse((await characters.getById(importedCharacter.characterId))!.data).summary, longSummary);

  response = await app.inject({ method: "GET", url: `/api/characters/personas/${persona.id}` });
  assert.equal(response.json().summary, longSummary);
  assert.equal(response.json().mes_example, "Saved example");
  const summarySearch = await app.inject({
    method: "GET",
    url: "/api/characters/personas/list?search=Thoughtful%20scientist",
  });
  assert.equal(summarySearch.statusCode, 200, summarySearch.body);
  assert.deepEqual(
    summarySearch.json().items.map((item: { id: string }) => item.id),
    [persona.id],
    "paginated library search finds text present only in the new persona summary",
  );
  const noMatch = await app.inject({
    method: "GET",
    url: "/api/characters/personas/list?search=no-such-persona-summary",
  });
  assert.deepEqual(noMatch.json().items, [], "the search still filters unrelated personas");
  const duplicate = await characters.duplicatePersona(persona.id);
  assert.equal(duplicate?.summary, longSummary);
  assert.equal(duplicate?.mes_example, "Saved example");
  await characters.updatePersona(persona.id, { summary: "New synopsis", mes_example: "New dialogue" });
  const versions = await characters.listPersonaVersions(persona.id);
  const old = versions.find((version) => version.data.summary === longSummary);
  assert.ok(old);
  await characters.restorePersonaVersion(persona.id, old.id);
  assert.equal((await characters.getPersona(persona.id))?.mes_example, "Saved example");
  for (const format of ["native", "compatible"]) {
    const exported = await app.inject({
      method: "GET",
      url: `/api/characters/personas/${persona.id}/export?format=${format}`,
    });
    assert.equal(exported.statusCode, 200, exported.body);
    const body = exported.json();
    const data = format === "native" ? body.data : body;
    assert.equal(data.summary, longSummary);
    assert.equal(data.mes_example, "Saved example");
    const imported = await importMarinara(
      { type: "marinara_persona", version: 1, exportedAt: new Date().toISOString(), data },
      db,
    );
    assert.equal(imported.success, true);
    assert.ok(imported.id);
    const row = await characters.getPersona(imported.id);
    assert.equal(row?.summary, longSummary);
    assert.equal(row?.mes_example, "Saved example");
  }
  // A real browser connection closing must cancel its held upstream request, for both editors.
  await app.listen({ port: 0, host: "127.0.0.1" });
  const appAddress = app.server.address();
  assert.ok(appAddress && typeof appAddress !== "string");
  const originalError = logger.error;
  const cancellationErrors: unknown[][] = [];
  logger.error = ((...args: unknown[]) => {
    cancellationErrors.push(args);
  }) as typeof logger.error;
  try {
    for (const url of [characterPath, personaPath]) {
      let started!: () => void;
      let closed!: () => void;
      const providerStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      const providerClosed = new Promise<void>((resolve) => {
        closed = resolve;
      });
      heldProvider = { started, closed };
      const controller = new AbortController();
      const before = requests.length;
      const pending = fetch(`http://127.0.0.1:${appAddress.port}${url}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "appearance", card }),
        signal: controller.signal,
      });
      const clientAborted = assert.rejects(pending, (error: Error) => error.name === "AbortError");
      await providerStarted;
      controller.abort();
      await clientAborted;
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(
          () => reject(new Error("disconnected editor left its paid provider request running")),
          3000,
        );
        providerClosed.then(() => {
          clearTimeout(deadline);
          resolve();
        });
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(requests.length, before + 1, "cancellation never sends another fallback request");
      heldProvider = null;
      heldResponse = null;
    }
    assert.equal(cancellationErrors.length, 0, "expected editor cancellation is not recorded as a generation error");
  } finally {
    logger.error = originalError;
  }

  const legacy = await characters.createPersona("Legacy", "Legacy description");
  assert.equal(legacy?.summary, "");
  assert.equal(legacy?.mes_example, "");
  console.log(
    "card-field-generation: all offline route, prompt, connection, boundary, persistence and round-trip checks passed",
  );
} finally {
  heldResponse?.destroy();
  provider.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  if (previousStorage === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorage;
  rmSync(directory, { recursive: true, force: true });
}
