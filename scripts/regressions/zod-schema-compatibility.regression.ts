// A native Zod upgrade must not turn a sparse PATCH into a replacement or drop import defaults.
import assert from "node:assert/strict";
import { z } from "../../packages/server/node_modules/zod/index.js";
import * as schemas from "../../packages/shared/src/index.js";

for (const name of [
  "avatarConfigUpdateSchema",
  "noodleSettingsUpdateSchema",
  "updateAgentConfigSchema",
  "updateChatPresetSchema",
  "updateChoiceBlockSchema",
  "updateCustomToolSchema",
  "updateGroupSchema",
  "updateLorebookEntrySchema",
  "updateLorebookFolderSchema",
  "updateLorebookSchema",
  "updatePersonaGroupSchema",
  "updatePromptGroupSchema",
  "updatePromptPresetSchema",
  "updatePromptSectionSchema",
  "updateRegexScriptSchema",
] as const) {
  assert.deepEqual(schemas[name].parse({}), {}, `${name} must not supply omitted create-time defaults`);
}

assert.deepEqual(schemas.updateCharacterSchema.parse({ data: { extensions: { appearance: "New coat" } } }), {
  data: { extensions: { appearance: "New coat" } },
});
assert.deepEqual(schemas.updateCharacterSchema.parse({ data: { extensions: { depth_prompt: { depth: 7 } } } }), {
  data: { extensions: { depth_prompt: { depth: 7 } } },
});
const imported = schemas.characterCardV2Schema.parse({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name: "Fixture", extensions: { externalExtension: { preserved: true } }, externalField: "keep" },
});
assert.deepEqual(imported.data.extensions.depth_prompt, { prompt: "", depth: 4, role: "system" });
assert.deepEqual(imported.data.extensions.externalExtension, { preserved: true });
assert.equal(imported.data.externalField, "keep");
assert.deepEqual(schemas.partialInput(schemas.createConnectionSchema).parse({ name: "Renamed" }), {
  name: "Renamed",
});
const explicitUndefined = schemas.partialInput(schemas.createConnectionSchema).parse({ name: undefined });
assert.ok(Object.hasOwn(explicitUndefined, "name"), "explicit undefined retains its own key");
assert.equal(explicitUndefined.name, undefined);
assert.equal(schemas.partialInput(schemas.createConnectionSchema).safeParse({ maxContext: 0 }).success, false);
assert.equal(schemas.updateLorebookSchema.safeParse({ name: "" }).success, false);
assert.deepEqual(schemas.experiencePersonSchema.parse({ person: "town-1", expressions: { happy: "happy.png" } }), {
  person: "town-1",
  expressions: { happy: "happy.png" },
});
assert.equal(
  schemas.experiencePersonSchema.safeParse({ person: "town-1", expressions: { unknown: "unknown.png" } }).success,
  false,
);

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
app.post("/validation-probe/many", (request) =>
  schemas.partialInput(z.object({ values: z.array(z.number()) })).parse(request.body),
);
app.post("/validation-probe/union", (request) =>
  z.object({ value: z.union([z.string(), z.number()]) }).parse(request.body),
);
try {
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  const chats = createChatsStorage(db);
  const chat = await chats.create(
    schemas.createChatSchema.parse({ name: "Before", mode: "roleplay", characterIds: ["kept"] }),
  );
  const renamedChat = await app.inject({ method: "PATCH", url: `/api/chats/${chat.id}`, payload: { name: "After" } });
  assert.equal(renamedChat.statusCode, 200, renamedChat.body);
  const storedChat = await chats.getById(chat.id);
  assert.equal(storedChat?.mode, "roleplay");
  assert.deepEqual(JSON.parse(storedChat!.characterIds as string), ["kept"]);

  const connections = createConnectionsStorage(db);
  const connection = await connections.create(
    schemas.createConnectionSchema.parse({
      name: "Before",
      provider: "custom",
      baseUrl: "https://example.com/v1",
      model: "keep-model",
      maxContext: 65536,
    }),
  );
  const renamedConnection = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connection.id}`,
    payload: { name: "After" },
  });
  assert.equal(renamedConnection.statusCode, 200, renamedConnection.body);
  const storedConnection = await connections.getById(connection.id);
  assert.equal(storedConnection?.model, "keep-model");
  assert.equal(storedConnection?.maxContext, 65536);
  assert.equal(storedConnection?.baseUrl, "https://example.com/v1");

  for (const [payload, issue] of [
    [{ temperature: "hot" }, { path: "temperature", message: "Invalid input: expected number, received string" }],
    [
      { customThinkingTags: [{ open: 5, close: "x" }] },
      { path: "customThinkingTags.0.open", message: "Invalid input: expected string, received number" },
    ],
    [{ temperature: 3 }, { path: "temperature", message: "Too big: expected number to be <=2" }],
  ]) {
    const invalidDefaults = await app.inject({
      method: "PUT",
      url: `/api/connections/${connection.id}/default-parameters`,
      payload,
    });
    assert.equal(invalidDefaults.statusCode, 400, invalidDefaults.body);
    assert.deepEqual(invalidDefaults.json(), { error: "Invalid generation parameters", issues: [issue] });
  }

  const characters = createCharactersStorage(db);
  const character = await characters.create(
    schemas.characterDataSchema.parse({
      name: "Fixture",
      description: "Keep description",
      tags: ["kept"],
      extensions: { appearance: "Old coat", depth_prompt: { prompt: "Keep prompt", depth: 8, role: "user" } },
    }),
  );
  const changedCharacter = await app.inject({
    method: "PATCH",
    url: `/api/characters/${character.id}`,
    payload: {
      data: { extensions: { appearance: "New coat" } },
    },
  });
  assert.equal(changedCharacter.statusCode, 200, changedCharacter.body);
  const storedCharacter = await characters.getById(character.id);
  const data = JSON.parse(storedCharacter!.data as string);
  assert.equal(data.description, "Keep description");
  assert.deepEqual(data.tags, ["kept"]);
  assert.deepEqual(data.extensions.depth_prompt, { prompt: "Keep prompt", depth: 8, role: "user" });
  const rejected = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connection.id}`,
    payload: { maxContext: 0 },
  });
  assert.equal(rejected.statusCode, 400, rejected.body);
  assert.ok(Array.isArray(rejected.json().details), "native validation errors retain structured details");
  for (const [name, message] of [
    [5, "Invalid input: expected string, received number"],
    ["", "Too small: expected string to have >=1 characters"],
  ] as const) {
    const invalidName = await app.inject({
      method: "PATCH",
      url: `/api/connections/${connection.id}`,
      payload: { name },
    });
    assert.equal(invalidName.statusCode, 400, invalidName.body);
    assert.deepEqual(invalidName.json().details, [{ path: "name", message }]);
    assert.equal((await connections.getById(connection.id))?.name, "After", "invalid updates change no data");
  }
  const invalidDepth = await app.inject({
    method: "PATCH",
    url: `/api/characters/${character.id}`,
    payload: { data: { extensions: { depth_prompt: { depth: "invalid" } } } },
  });
  assert.equal(invalidDepth.statusCode, 400, invalidDepth.body);
  assert.deepEqual(invalidDepth.json().details, [
    {
      path: "data.extensions.depth_prompt.depth",
      message: "Invalid input: expected number, received string",
    },
  ]);
  const many = await app.inject({
    method: "POST",
    url: "/validation-probe/many",
    payload: { values: Array(75).fill("invalid") },
  });
  assert.equal(many.statusCode, 400);
  assert.equal(many.json().details.length, 50, "unwrapping preserves the validation detail cap");
  assert.equal(many.json().details[0].path, "values.0");
  assert.equal(many.json().details[49].path, "values.49");
  const realUnion = await app.inject({ method: "POST", url: "/validation-probe/union", payload: { value: false } });
  assert.equal(realUnion.statusCode, 400);
  assert.deepEqual(
    realUnion.json().details,
    [{ path: "value", message: "Invalid input" }],
    "ordinary union errors retain their meaning",
  );
} finally {
  await app.close();
  await closeDB();
}
console.log("Zod schema compatibility regression passed.");
