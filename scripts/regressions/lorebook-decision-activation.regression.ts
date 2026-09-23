/**
 * Lorebook entries activated by a Decision model statement (#6570).
 *
 * The scanner rules are pinned directly, then `processLorebooks` with a fake resolver
 * proves the ask rounds (one request, a second for entries reached through another
 * decision entry, nothing for entries that could not activate anyway), and real
 * generate and Peek Prompt runs against a fake System One server prove the wiring.
 * Import and export keep the two fields.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-lorebook-decisions-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { createLorebookEntrySchema, containsDecisionStatements, parseLorebookDecisionActivation, characterDataSchema } =
  await import("../../packages/shared/dist/index.js");
const { scanForActivatedEntries } = await import("../../packages/server/src/services/lorebook/keyword-scanner.js");

// ── the scanner ────────────────────────────────────────────────────────────────

let nextId = 0;
const entry = (overrides: Record<string, unknown>) => ({
  ...createLorebookEntrySchema.parse({ lorebookId: "book", name: `e${nextId}`, ...overrides }),
  id: `e${nextId++}`,
  embedding: null,
  sourceAgentId: null,
  sourceMessageRefs: [],
});
const messages = [{ role: "user", content: "A dragon lands in the courtyard." }];
const require_ = entry({ keys: ["dragon"], decisionMode: "require", decisionStatement: "A dragon is present" });
const trigger = entry({ keys: [], decisionMode: "trigger", decisionStatement: "They are in a forest" });
const triggerByKey = entry({ keys: ["courtyard"], decisionMode: "trigger", decisionStatement: "Unused" });
const plain = entry({ keys: ["dragon"] });
const unmatched = entry({ keys: ["tavern"], decisionMode: "require", decisionStatement: "Never asked" });
const neverRolls = entry({
  keys: ["dragon"],
  probability: 0,
  decisionMode: "require",
  decisionStatement: "Rolled out",
});
const constantRequire = entry({ constant: true, decisionMode: "require", decisionStatement: "A fight is happening" });
const emptyStatement = entry({ keys: ["dragon"], decisionMode: "require", decisionStatement: "  " });
// The primary key matches but the secondary-key logic rejects it: the keywords fail, so
// the Trigger statement decides.
const selectiveTrigger = entry({
  keys: ["dragon"],
  selective: true,
  secondaryKeys: ["tavern"],
  decisionMode: "trigger",
  decisionStatement: "The dragon is hostile",
});
const all = [
  require_,
  trigger,
  triggerByKey,
  plain,
  unmatched,
  neverRolls,
  constantRequire,
  emptyStatement,
  selectiveTrigger,
];

const scan = (answers?: Map<string, boolean>) => {
  const pendingDecisions = new Set<string>();
  const activated = scanForActivatedEntries(messages, all as never, {
    decisionAnswers: answers,
    pendingDecisions,
    random: () => 0.5,
  });
  return { ids: new Set(activated.map((a) => a.entry.id)), activated, pending: pendingDecisions };
};

let result = scan();
assert.deepEqual(
  [...result.pending].sort(),
  [require_.id, trigger.id, constantRequire.id, selectiveTrigger.id].sort(),
  "only entries that would otherwise activate wait on a statement",
);
assert.ok(result.ids.has(plain.id) && result.ids.has(triggerByKey.id), "keywords still activate");
assert.ok(result.ids.has(emptyStatement.id), "an empty statement is off");
assert.ok(!result.ids.has(require_.id) && !result.ids.has(trigger.id), "no answer reads as no");

result = scan(
  new Map([
    [require_.id, true],
    [trigger.id, true],
    [constantRequire.id, false],
    [selectiveTrigger.id, true],
  ]),
);
assert.ok(result.ids.has(selectiveTrigger.id), "Trigger: activated when the secondary keys reject the match");
assert.equal(result.pending.size, 0);
assert.ok(result.ids.has(require_.id), "Require: keywords matched and the statement is true");
assert.ok(!result.ids.has(constantRequire.id), "Require on a constant entry makes it situational");
const triggered = result.activated.find((a) => a.entry.id === trigger.id)!;
assert.deepEqual(triggered.activationSources, ["decision"], "Trigger: activated by the statement alone");
assert.deepEqual(triggered.matchedKeys, ["[decision]"]);

const sticky = scanForActivatedEntries(messages, [require_] as never, {
  timingStates: new Map([
    [require_.id, { lastActivatedAt: 1, stickyCount: 2, cooldownRemaining: 0, delayRemaining: 0 }],
  ]),
  pendingDecisions: new Set(),
});
assert.equal(sticky.length, 1, "a sticky entry stays without being asked again");

assert.equal(parseLorebookDecisionActivation({ decisionMode: "sometimes" }).decisionMode, "off");
assert.equal(parseLorebookDecisionActivation({ decisionStatement: "x".repeat(900) }).decisionStatement.length, 500);
assert.equal(containsDecisionStatements({ entries: [{ decisionMode: "trigger", decisionStatement: "x" }] }), true);
assert.equal(containsDecisionStatements({ entries: [{ decisionMode: "off", decisionStatement: "x" }] }), false);

// ── processLorebooks: the ask rounds ───────────────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { processLorebooks } = await import("../../packages/server/src/services/lorebook/index.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { importSTLorebook } = await import("../../packages/server/src/services/import/st-lorebook.importer.js");
const { importMarinara } = await import("../../packages/server/src/services/import/marinara.importer.js");

const db = await getDB();
const lorebooks = createLorebooksStorage(db);
const chats = createChatsStorage(db);

try {
  const book = await lorebooks.create({ name: "Decision lore", recursiveScanning: true });
  assert(book);
  const make = (input: Record<string, unknown>) => lorebooks.createEntry({ lorebookId: book.id, ...input } as never);
  const dragon = await make({
    name: "Dragon",
    content: "DRAGON_LORE",
    keys: ["dragon"],
    decisionMode: "require",
    decisionStatement: "In the latest message, a dragon is physically present",
  });
  const forest = await make({
    name: "Forest",
    content: "FOREST_LORE: an old scale lies in the moss.",
    keys: [],
    decisionMode: "trigger",
    decisionStatement: "The latest message takes place in a forest",
    preventRecursion: false,
  });
  const scaleLore = await make({
    name: "Scale",
    content: "SCALE_LORE",
    keys: ["scale"],
    decisionMode: "require",
    decisionStatement: "Someone examines the scale",
  });
  const tavern = await make({
    name: "Tavern",
    content: "TAVERN_LORE",
    keys: ["tavern"],
    decisionMode: "require",
    decisionStatement: "They are in a tavern",
  });
  assert(dragon && forest && scaleLore && tavern);
  assert.equal((await lorebooks.getEntry(forest.id))!.decisionMode, "trigger", "the fields are stored and read back");

  const calls: string[][] = [];
  const yes = new Set([dragon.id, forest.id, scaleLore.id]);
  const scanBook = (resolve?: boolean) =>
    processLorebooks(db, [{ role: "user", content: "A dragon circles over the pines." }], null, {
      activeLorebookIds: [book.id],
      previewOnly: true,
      random: () => 0.5,
      ...(resolve
        ? {
            resolveDecisions: async (requests: Array<{ entryId: string; statement: string }>) => {
              calls.push(requests.map((r) => r.statement).sort());
              return new Map(requests.map((r) => [r.entryId, yes.has(r.entryId)]));
            },
          }
        : {}),
    });
  const none = await scanBook();
  assert.deepEqual(none.activatedEntryIds, [], "with no resolver every decision entry reads as no");
  const withAnswers = await scanBook(true);
  assert.deepEqual(calls, [
    ["In the latest message, a dragon is physically present", "The latest message takes place in a forest"],
    ["Someone examines the scale"],
  ]);
  assert.deepEqual(
    [...withAnswers.activatedEntryIds].sort(),
    [dragon.id, forest.id, scaleLore.id].sort(),
    "two requests: the second for the entry reached through the forest entry's text",
  );
  assert.ok(!calls.flat().includes("They are in a tavern"), "an entry whose keywords never matched is not asked");

  // ── generation, the per-turn cache and Peek Prompt ───────────────────────────

  let noul = 0.9;
  const decisionBodies: Array<{ questions: Record<string, { instructions?: string }> }> = [];
  const prompts: string[] = [];
  const provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (request.url?.endsWith("/systemone")) {
      decisionBodies.push(body);
      const out: Record<string, unknown> = {};
      for (const id of Object.keys(body.questions)) out[id] = { type: "noul", noul };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ answers: out }));
      return;
    }
    prompts.push(JSON.stringify(body.messages ?? []));
    const content = "Reply.";
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  const app = Fastify();
  app.decorate("db", db);
  app.decorate("activeGenerations", new Map());
  await app.register(generateRoutes, { prefix: "/api/generate" });
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  try {
    await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
    const address = provider.address();
    assert(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/v1`;
    const connections = createConnectionsStorage(db);
    const chatConnection = await connections.create({
      name: "Chat fixture",
      provider: "custom",
      baseUrl,
      model: "fixture",
      apiKey: "fixture",
      maxContext: 8192,
      maxTokensOverride: 256,
    });
    assert(chatConnection);
    assert(
      await connections.create({
        name: "Decision fixture",
        provider: "decision",
        decisionSource: "custom",
        baseUrl,
        model: "jev-latest",
        maxStateTokens: 3500,
        defaultForAgents: true,
      }),
    );
    const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Kaelen" }));
    assert(character);
    const genBook = await lorebooks.create({ name: "Generation lore" });
    assert(genBook);
    await lorebooks.createEntry({
      lorebookId: genBook.id,
      name: "Woods",
      content: "WOODS_LORE",
      keys: [],
      decisionMode: "trigger",
      decisionStatement: "The latest message takes place in the woods",
    } as never);
    const makeChat = async (name: string) => {
      const chat = await chats.create({
        name,
        mode: "roleplay",
        characterIds: [character.id],
        connectionId: chatConnection.id,
      });
      assert(chat);
      await chats.patchMetadata(chat.id, {
        enableAgents: false,
        enableMemoryRecall: false,
        activeLorebookIds: [genBook.id],
      });
      return chat;
    };
    const asked = (from: number) =>
      decisionBodies
        .slice(from)
        .flatMap((body) => Object.values(body.questions).map((q) => q.instructions ?? ""))
        .filter((text) => text.includes("in the woods"));

    // A fresh chat's Peek Prompt never asks, and reports the unanswered statement.
    const previewChat = await makeChat("Lore preview");
    const beforePeek = decisionBodies.length;
    const peek = await app.inject({ method: "POST", url: `/api/chats/${previewChat.id}/peek-prompt`, payload: {} });
    assert.equal(peek.statusCode, 200, peek.body);
    assert.equal(decisionBodies.length, beforePeek, "Peek Prompt never asks");
    assert.ok(!peek.body.includes("WOODS_LORE"), "an unanswered Trigger entry is not in the preview");
    assert.deepEqual(peek.json().decisions?.unanswered, ["The latest message takes place in the woods"]);

    // Generation asks once, activates the entry, and a regeneration reuses the answer.
    const chat = await makeChat("Lore turn");
    const turn = async (payload: Record<string, unknown>) => {
      const from = { decisions: decisionBodies.length, prompts: prompts.length };
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, ...payload },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
      return from;
    };
    let from = await turn({ userMessage: "They walk under the old oaks." });
    assert.equal(asked(from.decisions).length, 1, "the Trigger statement is asked");
    assert.ok(prompts.slice(from.prompts).join("\n").includes("WOODS_LORE"), "and the entry is in the prompt");
    const reply = (await chats.listMessages(chat.id)).filter((m: { role: string }) => m.role === "assistant").at(-1)!;
    noul = 0.1;
    from = await turn({ regenerateMessageId: reply.id });
    assert.equal(asked(from.decisions).length, 0, "a regeneration reuses the turn's answer");
    assert.ok(prompts.slice(from.prompts).join("\n").includes("WOODS_LORE"));
    from = await turn({ userMessage: "They leave the woods for the city." });
    assert.equal(asked(from.decisions).length, 1, "a new message asks again");
    assert.ok(!prompts.slice(from.prompts).join("\n").includes("WOODS_LORE"), "and a no leaves the entry out");

    // Conversation mode and a preset's lorebook marker scan through their own paths.
    noul = 0.9;
    const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
    const presets = createPromptsStorage(db);
    const preset = await presets.create({ name: "Lore preset", parameters: { maxTokens: 256, maxContext: 8192 } });
    assert(preset);
    await presets.createSection({
      presetId: preset.id,
      identifier: "world",
      name: "World Info",
      isMarker: true,
      markerConfig: { type: "world_info_before" },
    });
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "Chat History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
    for (const [mode, promptPresetId] of [
      ["conversation", undefined],
      ["roleplay", preset.id],
    ] as const) {
      const other = await chats.create({
        name: `Lore ${mode} ${promptPresetId ? "preset" : "plain"}`,
        mode,
        characterIds: [character.id],
        connectionId: chatConnection.id,
        ...(promptPresetId ? { promptPresetId } : {}),
      });
      assert(other);
      await chats.patchMetadata(other.id, {
        enableAgents: false,
        enableMemoryRecall: false,
        activeLorebookIds: [genBook.id],
      });
      const before = { decisions: decisionBodies.length, prompts: prompts.length };
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: other.id, userMessage: "We picnic in the woods." },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(asked(before.decisions).length, 1, `${mode}${promptPresetId ? " with a preset" : ""}: asked`);
      assert.ok(
        prompts.slice(before.prompts).join("\n").includes("WOODS_LORE"),
        `${mode}${promptPresetId ? " with a preset" : ""}: the entry is in the prompt`,
      );
    }

    // ── import and export keep the fields ──────────────────────────────────────

    const compatible = await app.inject({ method: "GET", url: `/api/lorebooks/${book.id}/export?format=compatible` });
    assert.equal(compatible.statusCode, 200, compatible.body);
    const exportedForest = Object.values(compatible.json().entries as Record<string, Record<string, unknown>>).find(
      (e) => e.comment === "Forest",
    )!;
    assert.equal(exportedForest.decisionMode, "trigger");
    const reimported = await importSTLorebook(compatible.json(), db, { fallbackName: "Round trip" });
    const reimportedEntries = await lorebooks.listEntries((reimported as { lorebookId: string }).lorebookId);
    assert.equal(reimportedEntries.find((e: { name: string }) => e.name === "Forest")?.decisionMode, "trigger");
    assert.equal(
      reimportedEntries.find((e: { name: string }) => e.name === "Dragon")?.decisionStatement,
      "In the latest message, a dragon is physically present",
    );
    const native = await app.inject({ method: "GET", url: `/api/lorebooks/${book.id}/export` });
    assert.equal(native.statusCode, 200, native.body);
    const booksBefore = new Set(((await lorebooks.list()) as Array<{ id: string }>).map((b) => b.id));
    const nativeImport = await importMarinara(native.json(), db);
    assert.equal(nativeImport.success, true, JSON.stringify(nativeImport));
    const nativeCopy = ((await lorebooks.list()) as Array<{ id: string }>).find((b) => !booksBefore.has(b.id));
    assert(nativeCopy, "the native import created a new lorebook");
    const nativeEntries = await lorebooks.listEntries(nativeCopy.id);
    assert.equal(nativeEntries.find((e: { name: string }) => e.name === "Scale")?.decisionMode, "require");

    // ── Professor Mari reads and writes the fields like the entry API ─────────
    const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
    const mariDb = new MariDbService(db);
    const created = await mariDb.executeAction({
      action: "lorebook.createEntry",
      lorebookId: genBook.id,
      data: { name: "Mari entry", content: "x", decisionMode: "Trigger", decisionStatement: "A storm breaks" },
      apply: true,
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    const mariEntry = (await lorebooks.listEntries(genBook.id)).find((e: { name: string }) => e.name === "Mari entry")!;
    assert.equal(mariEntry.decisionMode, "trigger");
    assert.equal(mariEntry.decisionStatement, "A storm breaks");
    const cleared = await mariDb.executeAction({
      action: "lorebook.updateEntry",
      entryId: mariEntry.id,
      patch: { decisionStatement: "" },
      apply: true,
    });
    assert.equal(cleared.ok, true, JSON.stringify(cleared));
    assert.equal((await lorebooks.getEntry(mariEntry.id))!.decisionStatement, "", "an empty statement clears it");
    const refused = await mariDb
      .executeAction({
        action: "lorebook.updateEntry",
        entryId: mariEntry.id,
        patch: { decisionMode: "sometimes" },
        apply: true,
      })
      .catch((error: Error) => ({ ok: false, error: error.message }));
    assert.equal(refused.ok, false, "an unknown mode is refused, not turned off");
    assert.equal((await lorebooks.getEntry(mariEntry.id))!.decisionMode, "trigger");

    console.log("lorebook-decision-activation regression passed");
  } finally {
    await app.close();
    await new Promise<void>((done) => provider.close(() => done()));
  }
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
