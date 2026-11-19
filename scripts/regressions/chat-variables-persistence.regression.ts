// Chat variables share their store with {{setvar}}, which a running generation
// writes back mid-request. The metadata route must therefore merge rather than
// replace, and must express a removal explicitly.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-variables-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { normalizeChatMacroVariables, mergeGeneratedChatMacroVariables } =
  await import("../../packages/server/src/services/prompt/macro-context.js");
const { MAX_CHAT_VARIABLES } = await import("../../packages/shared/src/index.js");
const { chats: chatsTable } = await import("../../packages/server/src/db/schema/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Variables",
    mode: "roleplay",
    characterIds: [],
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    groupId: null,
  });
  assert.ok(chat);

  const patchVariables = (macroVariables: Record<string, string | null>) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chat.id}/metadata`, payload: { macroVariables } });
  const storedVariables = async () => {
    const current = await chats.getById(chat.id);
    const metadata = typeof current!.metadata === "string" ? JSON.parse(current!.metadata) : (current!.metadata ?? {});
    return normalizeChatMacroVariables(metadata.macroVariables);
  };

  // A patch adds names without disturbing the ones it does not mention.
  assert.equal((await patchVariables({ char1: "Mary" })).statusCode, 200);
  assert.equal((await patchVariables({ char2: "Ana" })).statusCode, 200);
  assert.deepEqual(await storedVariables(), { char1: "Mary", char2: "Ana" });

  // Editing one value leaves the rest alone.
  assert.equal((await patchVariables({ char1: "Anna" })).statusCode, 200);
  assert.deepEqual(await storedVariables(), { char1: "Anna", char2: "Ana" });

  // null removes a name.
  assert.equal((await patchVariables({ char2: null })).statusCode, 200);
  assert.deepEqual(await storedVariables(), { char1: "Anna" });

  // A rename travels as one patch so it cannot half-apply.
  assert.equal((await patchVariables({ char1: null, lead: "Anna" })).statusCode, 200);
  assert.deepEqual(await storedVariables(), { lead: "Anna" });

  // A generation's {{setvar}} write lands in the same key. The next UI patch
  // must not drop it.
  await chats.patchMetadata(
    chat.id,
    (current) => ({
      ...current,
      macroVariables: { ...normalizeChatMacroVariables(current.macroVariables), mood: "tense" },
    }),
    { touchUpdatedAt: false },
  );
  assert.equal((await patchVariables({ lead: "Mary" })).statusCode, 200);
  assert.deepEqual(await storedVariables(), { lead: "Mary", mood: "tense" });

  // A generation started before the editor changed these names. Its pending
  // setvar writes must not resurrect a deleted/renamed name or replace an edit.
  const beforeGeneration = await storedVariables();
  assert.equal((await patchVariables({ lead: null, hero: "Mary", mood: "calm" })).statusCode, 200);
  await chats.patchMetadata(chat.id, (current) => ({
    macroVariables: mergeGeneratedChatMacroVariables(current.macroVariables, beforeGeneration, {
      ...beforeGeneration,
      lead: "stale",
      mood: "angry",
      fresh: "generated",
    }),
  }));
  assert.deepEqual(await storedVariables(), { hero: "Mary", mood: "calm", fresh: "generated" });
  assert.equal((await patchVariables({ hero: null, fresh: null, lead: "Mary", mood: "tense" })).statusCode, 200);
  assert.deepEqual(
    mergeGeneratedChatMacroVariables({ mood: "calm" }, { mood: "calm" }, { mood: "happy" }),
    { mood: "happy" },
    "a generation still updates values untouched since its snapshot",
  );
  assert.equal(
    mergeGeneratedChatMacroVariables({}, {}, { ["__proto__"]: "safe own value" })["__proto__"],
    "safe own value",
  );
  // Saved maps keep only string values under valid names, and never more than MAX_CHAT_VARIABLES of them.
  assert.deepEqual(normalizeChatMacroVariables({ score: "8", invalid: 4, "bad name": "x" }), { score: "8" });
  assert.deepEqual(normalizeChatMacroVariables({ ...normalizeChatMacroVariables({ counter: "2" }), counter: "3" }), {
    counter: "3",
  });
  const capped = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`v${i}`, "x"]));
  assert.equal(
    Object.keys(normalizeChatMacroVariables(capped(MAX_CHAT_VARIABLES + 1))).length,
    MAX_CHAT_VARIABLES,
    "persisted chat-local macro variables remain capped",
  );
  assert.deepEqual(
    mergeGeneratedChatMacroVariables(capped(MAX_CHAT_VARIABLES), capped(MAX_CHAT_VARIABLES), {
      ...capped(MAX_CHAT_VARIABLES),
      overflow: "generated",
    }),
    capped(MAX_CHAT_VARIABLES),
    "generation writes reapply the macro-variable cap after merging request changes",
  );

  // A name a {{setvar}} created keeps its own shape: still editable and
  // removable even though the UI could not have created it.
  await chats.patchMetadata(
    chat.id,
    (current) => ({
      ...current,
      macroVariables: { ...normalizeChatMacroVariables(current.macroVariables), "story.day": "3" },
    }),
    { touchUpdatedAt: false },
  );
  assert.equal((await patchVariables({ "story.day": "4" })).statusCode, 200);
  assert.equal((await storedVariables())["story.day"], "4");
  assert.equal((await patchVariables({ "story.day": null })).statusCode, 200);
  assert.ok(!("story.day" in (await storedVariables())));

  // …but a new name of that shape is refused, because a bare {{story.day}}
  // would never resolve.
  assert.equal((await patchVariables({ "story.day": "5" })).statusCode, 400);
  assert.equal((await patchVariables({ char: "Nope" })).statusCode, 400, "built-in macro name");
  assert.equal((await patchVariables({ "bad name": "x" })).statusCode, 400, "space is not storable");
  assert.equal(
    (await patchVariables({ ["constructor"]: "x" })).statusCode,
    400,
    "object members are not variable names",
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/chats/${chat.id}/metadata`,
        payload: { macroVariables: { char1: "Mary" }, summaryTailMessages: 3 },
      })
    ).statusCode,
    400,
    "a combined patch would skip the other keys' handling",
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/chats/${chat.id}/metadata`,
        payload: { macroVariables: { char1: 7 } },
      })
    ).statusCode,
    400,
    "values must be strings or null",
  );
  assert.deepEqual(await storedVariables(), { lead: "Mary", mood: "tense" }, "a rejected patch changes nothing");

  // A {{setvar}} can store a variable called __proto__. Fastify's JSON parser
  // refuses any body carrying that key, so it cannot be reached through this
  // route at all — the stored value simply stays as it was. (The handler also
  // collects changes in a null-prototype object, so a non-HTTP caller cannot be
  // silently ignored either.)
  await chats.patchMetadata(
    chat.id,
    (current) => ({
      ...current,
      macroVariables: { ...normalizeChatMacroVariables(current.macroVariables), ["__proto__"]: "before" },
    }),
    { touchUpdatedAt: false },
  );
  assert.equal((await storedVariables())["__proto__"], "before", "the fixture stored it as an own property");
  const protoPatch = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: '{"macroVariables":{"__proto__":"after"}}',
    headers: { "content-type": "application/json" },
  });
  assert.equal(protoPatch.statusCode, 400, "the JSON parser refuses the body outright");
  assert.equal((await storedVariables())["__proto__"], "before", "and nothing is written");
  await chats.patchMetadata(
    chat.id,
    (current) => {
      const kept = normalizeChatMacroVariables(current.macroVariables);
      delete kept["__proto__"];
      return { ...current, macroVariables: kept };
    },
    { touchUpdatedAt: false },
  );

  // Whether a name counts as "already stored" is judged when the write runs, not
  // when the request arrived. Holding the metadata queue with a patch that
  // removes the name makes the request's own read stale: the loose name is then
  // a creation, and creating a name a bare {{name}} could never address is
  // refused. Reading the arrival snapshot instead would have written it.
  await chats.patchMetadata(
    chat.id,
    (current) => ({
      ...current,
      macroVariables: { ...normalizeChatMacroVariables(current.macroVariables), "story.day": "3" },
    }),
    { touchUpdatedAt: false },
  );
  assert.equal((await storedVariables())["story.day"], "3", "the fixture is in place for the stale-read window");
  let releaseHold = () => {};
  const held = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  const holdingStarted = Promise.withResolvers<void>();
  const holding = chats.patchMetadata(
    chat.id,
    async (current) => {
      holdingStarted.resolve();
      await held;
      const kept = normalizeChatMacroVariables(current.macroVariables);
      delete kept["story.day"];
      return { ...current, macroVariables: kept };
    },
    { touchUpdatedAt: false },
  );
  await holdingStarted.promise;
  const requestRead = Promise.withResolvers<void>();
  const queryPrototype = Object.getPrototypeOf(db.select().from(chatsTable));
  const originalThen = queryPrototype.then;
  // Observe the actual database snapshot read by the route, rather than guessing
  // how long Fastify needs to reach it. The held removal has already read its row.
  const readSpy = mock.method(
    queryPrototype,
    "then",
    function (this: unknown, onfulfilled: (rows: any[]) => unknown, onrejected: (error: unknown) => unknown) {
      return originalThen.call(
        this,
        (rows: any[]) => {
          if (
            rows.some(
              (row) =>
                row.id === chat.id &&
                normalizeChatMacroVariables(JSON.parse(row.metadata).macroVariables)["story.day"] === "3",
            )
          ) {
            requestRead.resolve();
          }
          return onfulfilled(rows);
        },
        onrejected,
      );
    },
  );
  const staleRequest = patchVariables({ "story.day": "4" }).then((response) => response);
  try {
    await requestRead.promise;
  } finally {
    readSpy.mock.restore();
    releaseHold();
  }
  const [, staleResponse] = await Promise.all([holding, staleRequest]);
  assert.equal(staleResponse.statusCode, 400, "a name removed since the request began counts as a creation");
  assert.ok(!("story.day" in (await storedVariables())), "and nothing is written back under that name");

  // The 500-entry cap is enforced up front instead of quietly truncating.
  const bulk: Record<string, string> = {};
  for (let index = 0; index < MAX_CHAT_VARIABLES; index += 1) bulk[`bulk_${index}`] = String(index);
  await chats.patchMetadata(chat.id, (current) => ({ ...current, macroVariables: bulk }), { touchUpdatedAt: false });
  assert.equal(Object.keys(await storedVariables()).length, MAX_CHAT_VARIABLES);
  const overflow = await patchVariables({ one_too_many: "nope" });
  assert.equal(overflow.statusCode, 400, "a name past the cap is refused rather than dropped behind a 200");
  assert.ok(!("one_too_many" in (await storedVariables())));
  assert.equal(Object.keys(await storedVariables()).length, MAX_CHAT_VARIABLES, "the stored map is untouched");
  // Editing an existing name at the cap is still fine: the count does not grow.
  assert.equal((await patchVariables({ bulk_0: "edited" })).statusCode, 200);
  assert.equal((await storedVariables()).bulk_0, "edited");
  // And a patch that removes one while adding another stays within the cap.
  assert.equal((await patchVariables({ bulk_1: null, replacement: "ok" })).statusCode, 200);
  const atCap = await storedVariables();
  assert.ok(!("bulk_1" in atCap));
  assert.equal(atCap.replacement, "ok");

  // The storage gate stays permissive so existing setvar values survive.
  assert.deepEqual(normalizeChatMacroVariables({ "my.var": "kept", "bad name": "dropped", n: 1 }), {
    "my.var": "kept",
  });

  console.info("chat variables persistence regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
