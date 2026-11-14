/**
 * `{{include::ENTRY}}` and `{{include::BOOK::ENTRY}}` (#6912): a lorebook entry's text,
 * found by ID first, then by name. The short form looks in an entry's own lorebook, or in
 * the chat's lorebooks elsewhere; an include that loops back reads as empty. Agent prompts
 * read the same lorebooks as the chat (#7212).
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-lorebook-include-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { resolveMacros, createLorebookSchema, createLorebookEntrySchema } =
  await import("../../../packages/shared/src/index.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
const { processLorebooks } = await import("../../../packages/server/src/services/lorebook/index.js");
const { buildPromptMacroContext } = await import("../../../packages/server/src/services/prompt/macro-context.js");
const { assemblePrompt } = await import("../../../packages/server/src/services/prompt/assembler.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

// ── the macro itself ──────────────────────────────────────────────────────────

{
  const source = {
    books: [
      { id: "book-rules-0000000001", name: "Rules" },
      { id: "book-other-0000000002", name: "Other book" },
    ],
    entries: [
      { id: "entry-combat-00000001", lorebookId: "book-rules-0000000001", name: "Combat", content: "Roll to hit." },
      { id: "entry-greet-000000002", lorebookId: "book-rules-0000000001", name: "Greeting", content: "Hi {{user}}." },
      {
        id: "entry-loop-a-00000003",
        lorebookId: "book-rules-0000000001",
        name: "Loop A",
        content: "A({{include::Loop B}})",
      },
      {
        id: "entry-loop-b-00000004",
        lorebookId: "book-rules-0000000001",
        name: "Loop B",
        content: "B({{include::Loop A}})",
      },
      {
        id: "entry-self-0000000005",
        lorebookId: "book-rules-0000000001",
        name: "Self",
        content: "S({{include::Self}})",
      },
      {
        id: "entry-outer-000000006",
        lorebookId: "book-other-0000000002",
        name: "Outer",
        content: "Outer: {{include::Inner}}",
      },
      { id: "entry-inner-000000007", lorebookId: "book-other-0000000002", name: "Inner", content: "inner text" },
      { id: "entry-dup-00000000008", lorebookId: "book-other-0000000002", name: "Combat", content: "Other combat." },
    ],
    currentBookIds: ["book-rules-0000000001"],
  };
  const ctx = { user: "Ada", char: "Mira", characters: ["Mira"], variables: {}, lorebookIncludes: source };
  const resolve = (text: string) => resolveMacros(text, ctx);

  assert.equal(resolve("{{include::Combat}}"), "Roll to hit.", "a name is looked up in the current lorebooks");
  assert.equal(resolve("{{include:: combat }}"), "Roll to hit.", "names ignore case and surrounding spaces");
  assert.equal(resolve("{{include::entry-inner-000000007}}"), "inner text", "an ID is found in any lorebook");
  assert.equal(resolve("{{include::Inner}}"), "", "a name outside the current lorebooks is not found");
  assert.equal(resolve("{{include::Other book::Combat}}"), "Other combat.", "the long form picks the lorebook");
  assert.equal(resolve("{{include::book-other-0000000002::Inner}}"), "inner text", "by the lorebook's ID too");
  assert.equal(resolve("{{include::Rules::entry-combat-00000001}}"), "Roll to hit.", "and the entry's ID");
  assert.equal(resolve("{{include::Missing book::Combat}}"), "", "no lorebook means no text");
  assert.equal(resolve("[{{include::Nothing here}}]"), "[]", "no entry means no text");
  assert.equal(resolve("{{include::Greeting}}"), "Hi Ada.", "macros in included text are filled in");
  assert.equal(resolve("{{include::Other book::Outer}}"), "Outer: inner text", "a nested short form uses its own book");
  assert.equal(resolve("{{include::Loop A}}"), "A(B())", "A -> B -> A stops at the repeat");
  assert.equal(resolve("{{include::Self}}"), "S()", "A -> A stops at the repeat");
  assert.equal(resolve("{{include::Combat}} {{include::Combat}}"), "Roll to hit. Roll to hit.", "repeats side by side");
  assert.equal(
    resolveMacros("{{include::Combat}}", { user: "Ada", char: "Mira", characters: ["Mira"], variables: {} }),
    "{{include::Combat}}",
    "without loaded lorebooks the macro is left for a later pass",
  );
}

// ── lorebooks, chats and prompts ──────────────────────────────────────────────

const db = await getDB();
try {
  const lorebooks = createLorebooksStorage(db);
  const chats = createChatsStorage(db);
  const world = await lorebooks.create(createLorebookSchema.parse({ name: "World" }));
  const vault = await lorebooks.create(createLorebookSchema.parse({ name: "Vault", enabled: false }));
  const shared = await lorebooks.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: world.id,
      name: "Shared rules",
      content: "SHARED_RULES for {{user}}",
      enabled: false,
    }),
  );
  await lorebooks.createEntry(
    createLorebookEntrySchema.parse({
      lorebookId: world.id,
      name: "Combat",
      content: "Combat: {{include::Shared rules}} | {{include::Vault::Secret}} | [{{include::Combat}}]",
      constant: true,
    }),
  );
  await lorebooks.createEntry(
    createLorebookEntrySchema.parse({ lorebookId: vault.id, name: "Secret", content: "VAULT_SECRET" }),
  );
  const chat = await chats.create({ name: "Include chat", mode: "roleplay", characterIds: [] } as never);
  assert.ok(chat && shared);
  await chats.patchMetadata(chat.id, { activeLorebookIds: [world.id] });

  const scan = await processLorebooks(db, [{ role: "user", content: "Hello." }], null, {
    chatId: chat.id,
    characterIds: [],
    activeLorebookIds: [world.id],
    resolveContent: (value) => resolveMacros(value, { user: "Ada", char: "Mira", characters: [], variables: {} }),
  });
  assert.deepEqual(
    scan.activatedEntries.map((entry) => entry.content),
    ["Combat: SHARED_RULES for Ada | VAULT_SECRET | []"],
    "an entry includes a disabled entry of its own lorebook, an entry of a disabled lorebook, and never itself",
  );

  const macroCtx = await buildPromptMacroContext({
    db,
    characterIds: [],
    personaName: "Ada",
    chatId: chat.id,
    macroSources: ["{{include::Shared rules}}"],
  });
  assert.deepEqual(macroCtx.lorebookIncludes?.currentBookIds, [world.id], "elsewhere, the chat's lorebooks are used");
  assert.equal(resolveMacros("{{include::Shared rules}}", macroCtx), "SHARED_RULES for Ada");
  assert.equal(resolveMacros("{{include::Secret}}", macroCtx), "", "a lorebook the chat does not use needs its name");
  const plain = await buildPromptMacroContext({ db, characterIds: [], personaName: "Ada", macroSources: ["Hi."] });
  assert.equal(plain.lorebookIncludes, undefined, "lorebooks are only loaded when a prompt uses the macro");

  const assembled = await assemblePrompt({
    db,
    preset: {
      id: "include-preset",
      name: "Include",
      sectionOrder: JSON.stringify(["rules", "history"]),
      groupOrder: "[]",
      wrapFormat: "none",
      parameters: "{}",
      variableGroups: "[]",
      variableValues: "{}",
    },
    sections: [
      {
        id: "rules",
        presetId: "include-preset",
        identifier: "rules",
        name: "Rules",
        content: "House rules: {{include::Shared rules}}",
        role: "system",
        enabled: "true",
        isMarker: "false",
        groupId: null,
        markerConfig: null,
        injectionPosition: "ordered",
        injectionDepth: 0,
        injectionOrder: 0,
        forbidOverrides: "false",
      },
      {
        id: "history",
        presetId: "include-preset",
        identifier: "chatHistory",
        name: "Chat History",
        content: "",
        role: "system",
        enabled: "true",
        isMarker: "true",
        groupId: null,
        markerConfig: JSON.stringify({ type: "chat_history" }),
        injectionPosition: "ordered",
        injectionDepth: 0,
        injectionOrder: 1,
        forbidOverrides: "false",
      },
    ],
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: chat.id,
    characterIds: [],
    personaName: "Ada",
    personaDescription: "",
    chatMessages: [{ role: "user", content: "Read me {{include::Vault::Secret}}." }],
  } as never);
  const prompt = assembled.messages.map((message: { content: string }) => message.content).join("\n");
  assert.match(prompt, /House rules: SHARED_RULES for Ada/u, "a preset section includes an entry");
  assert.match(prompt, /Read me VAULT_SECRET\./u, "and so does a chat message");

  // A real turn: the author's note is outside the preset, so the route must notice it.
  const sent: string[] = [];
  const provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    sent.push(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString() || "{}").messages ?? []));
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Reply." }, finish_reason: null }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  const app = Fastify();
  app.decorate("db", db);
  app.decorate("activeGenerations", new Map());
  await app.register(generateRoutes, { prefix: "/api/generate" });
  try {
    await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
    const address = provider.address();
    assert(address && typeof address === "object");
    const connection = await createConnectionsStorage(db).create({
      name: "Chat fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "fixture",
      apiKey: "fixture",
      maxContext: 8192,
      maxTokensOverride: 256,
    });
    const presets = createPromptsStorage(db);
    const preset = await presets.create({ name: "Plain", parameters: { maxTokens: 256, maxContext: 8192 } });
    assert(connection && preset);
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "Chat History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    } as never);
    const turnChat = await chats.create({
      name: "Include turn",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: preset.id,
    } as never);
    assert(turnChat);
    await chats.patchMetadata(turnChat.id, {
      activeLorebookIds: [world.id],
      authorNotes: "Note: {{include::Shared rules}}",
      enableAgents: false,
      enableMemoryRecall: false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: turnChat.id, userMessage: "Hello." },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.match(sent.at(-1) ?? "", /Note: SHARED_RULES for /u, "an author's note includes an entry");

    // Agent prompts (#7212): each place the route runs an agent from reads the chat's lorebooks too.
    const agents = createAgentsStorage(db);
    const agentFixtures = [
      ["include-pre-fixture", "pre_generation", { resultType: "context_injection" }],
      [
        "include-activity-fixture",
        "pre_generation",
        { resultType: "character_activity_update", customCapabilities: { manage_chat_characters: true } },
      ],
      ["include-post-fixture", "post_processing", { resultType: "context_injection" }],
    ] as const;
    for (const [type, phase, settings] of agentFixtures) {
      await agents.create({
        type,
        name: type,
        phase,
        connectionId: null,
        promptTemplate: `AGENT ${type}: {{include::Shared rules}} | {{include::Vault::Secret}} | [{{include::Secret}}]`,
        settings,
      } as never);
    }
    // Only its author's note uses the macro, so a retry must load lorebooks for the note alone.
    await agents.create({
      type: "include-note-fixture",
      name: "include-note-fixture",
      phase: "post_processing",
      connectionId: null,
      promptTemplate: "AGENT include-note-fixture: no include here",
      settings: { resultType: "context_injection", contextSources: { chatHistory: true, authorNotes: true } },
    } as never);
    const agentChat = await chats.create({
      name: "Include agents",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: preset.id,
    } as never);
    assert(agentChat);
    await chats.patchMetadata(agentChat.id, {
      activeLorebookIds: [world.id],
      enableAgents: true,
      activeAgentIds: [...agentFixtures.map(([type]) => type), "include-note-fixture"],
      enableMemoryRecall: false,
    });
    // The short form stays in the chat's lorebooks, and no raw include reaches the provider.
    const assertAgentIncludes = (type: string, requests: string[], message: string) => {
      const request = requests.find((body) => body.includes(`AGENT ${type}:`));
      assert.ok(request, `${type} ran`);
      assert.ok(request.includes(`AGENT ${type}: SHARED_RULES for User | VAULT_SECRET | []`), message);
      assert.doesNotMatch(request, /\{\{\s*include::/iu, `${type} sends no raw include`);
    };
    const before = sent.length;
    const agentTurn = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: agentChat.id, userMessage: "Hello." },
    });
    assert.equal(agentTurn.statusCode, 200, agentTurn.body);
    for (const [type] of agentFixtures) {
      assertAgentIncludes(
        type,
        sent.slice(before),
        `${type} includes an entry by name from the chat's lorebooks only, and by lorebook name`,
      );
    }
    const beforeRetry = sent.length;
    const retried = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: agentChat.id, agentTypes: ["include-post-fixture"] },
    });
    assert.equal(retried.statusCode, 200, retried.body);
    assertAgentIncludes("include-post-fixture", sent.slice(beforeRetry), "a retried agent includes entries too");
    // Added only now, so nothing but agent prompts triggered the loads above.
    await chats.patchMetadata(agentChat.id, { authorNotes: "AGENT_NOTE {{include::Shared rules}}" });
    const beforeNoteRetry = sent.length;
    const noteRetried = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: agentChat.id, agentTypes: ["include-note-fixture"] },
    });
    assert.equal(noteRetried.statusCode, 200, noteRetried.body);
    assert.match(
      sent.slice(beforeNoteRetry).find((body) => body.includes("AGENT include-note-fixture:")) ?? "",
      /AGENT_NOTE SHARED_RULES for User/u,
      "a retried agent reads the author's note with its include filled in",
    );
  } finally {
    await app.close();
    await new Promise<void>((done) => provider.close(() => done()));
  }
  console.log("lorebook-include-macro regression passed");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
