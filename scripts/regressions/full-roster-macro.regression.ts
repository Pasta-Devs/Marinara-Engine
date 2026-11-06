import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
  characterDataSchema,
  planDecisionStatements,
  resolveMacros,
  type AgentContext,
} from "../../packages/shared/src/index.js";
import {
  buildMessageMacroContext,
  createInputMacroResolverForChat,
} from "../../packages/client/src/lib/chat-macros.js";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { buildPromptMacroContext, scopePromptMacroContextToCharacter } =
  await import("../../packages/server/src/services/prompt/macro-context.js");
const { buildAgentPromptMacroContext, renderAgentPromptTemplate } =
  await import("../../packages/server/src/services/agents/agent-executor.js");

const sent: string[] = [];
const provider = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  sent.push(JSON.stringify(JSON.parse(raw).messages));
  const chunk = { choices: [{ index: 0, delta: { content: "The crew carries on." }, finish_reason: null }] };
  const stop = { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`);
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Full roster fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  const characters = createCharactersStorage(db);
  const alpha = await characters.create(characterDataSchema.parse({ name: "Alpha", description: "ALPHA_ACTIVE_CARD" }));
  const outsider = await characters.create(
    characterDataSchema.parse({ name: "Outsider", description: "INACTIVE_REFERENCED_CARD_SECRET" }),
  );
  const hidden = await characters.create(
    characterDataSchema.parse({
      name: "Hidden",
      description: `INACTIVE_CARD_SECRET {{${outsider.id}}}`,
      system_prompt: "INACTIVE_SYSTEM_SECRET",
      extensions: { backstory: "INACTIVE_BACKSTORY_SECRET" },
    }),
  );
  const beta = await characters.create(characterDataSchema.parse({ name: "Beta", description: "BETA_ACTIVE_CARD" }));
  const rosterIds = [alpha.id, hidden.id, beta.id];
  const activeIds = [alpha.id, beta.id];
  const template = "CREW: {{characters}}. OTHER ACTIVE: {{group}}.";
  const expected = "CREW: Alpha, Hidden, Beta. OTHER ACTIVE: Beta.";
  const prompts = createPromptsStorage(db);
  const preset = await prompts.create({ name: "Full roster", parameters: { maxContext: 32768, maxTokens: 128 } });
  await prompts.createSection({ presetId: preset.id, identifier: "roster", name: "Roster", content: template });
  await prompts.createSection({
    presetId: preset.id,
    identifier: "character",
    name: "Cards",
    isMarker: true,
    markerConfig: { type: "character" },
  });
  await prompts.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chats = createChatsStorage(db);
  for (const mode of ["roleplay", "conversation"] as const) {
    const chat = await chats.create({
      name: `Full roster ${mode}`,
      mode,
      characterIds: rosterIds,
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    const metadata = {
      inactiveCharacterIds: [hidden.id],
      enableAgents: false,
      enableTools: false,
      enableMemoryRecall: false,
      groupChatMode: "merged",
      groupResponseOrder: "manual",
      groupScenarioText: template,
      customSystemPrompt: template,
    };
    await chats.patchMetadata(chat.id, metadata);
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue." });
    for (const scopedIds of [activeIds, [alpha.id]]) {
      const ctx = await buildPromptMacroContext({
        db,
        chatId: chat.id,
        characterIds: scopedIds,
        groupCharacterIds: activeIds,
        personaName: "Hidden",
        groupScenarioOverrideText: template,
        nameCharacterReferences: true,
      });
      assert.equal(resolveMacros(template, ctx), expected);
      assert.deepEqual(
        ctx.characterProfiles?.map((profile) => profile.name),
        scopedIds.map((id) => (id === alpha.id ? "Alpha" : "Beta")),
      );
      assert.doesNotMatch(
        JSON.stringify(ctx.characterProfiles),
        /INACTIVE_/,
        "a full name roster never widens card profiles",
      );
      assert.equal(
        ctx.characterReferences?.[outsider.id],
        undefined,
        "inactive fields do not trigger referenced-card discovery",
      );
      if (scopedIds.length === 1) {
        const decisions = [
          '{{#if char == "Alpha" && decision:"Active reader"}}yes{{/if}}',
          '{{#if char == "Hidden" && decision:"Inactive reader"}}no{{/if}}',
          '{{#if description == "ALPHA_ACTIVE_CARD" && decision:"Active card"}}yes{{/if}}',
        ].join("\n");
        assert.deepEqual([...planDecisionStatements(decisions, ctx).statements], ["Active reader", "Active card"]);
        assert.ok(
          planDecisionStatements(decisions, { ...ctx, characterProfiles: undefined }).statements.has("Inactive reader"),
          "without explicit reader profiles a larger roster remains conservatively unknown",
        );
        assert.ok(
          planDecisionStatements(decisions, {
            ...ctx,
            characterProfiles: [{ name: "Alpha" }, { name: "Beta" }],
          }).statements.has("Inactive reader"),
          "a multi-reader prompt still defers per-character operands",
        );
      }
      const betaContext = scopePromptMacroContextToCharacter(ctx, { name: "Beta" });
      assert.equal(resolveMacros(template, betaContext), "CREW: Alpha, Hidden, Beta. OTHER ACTIVE: Alpha.");
    }
    const check = (label: string, text: string) => {
      assert.ok(text.includes(expected), `${label}: ${text}`);
      assert.doesNotMatch(
        text,
        /INACTIVE_(?:CARD|SYSTEM|BACKSTORY|REFERENCED_CARD)_SECRET/,
        `${label}: inactive card fields must stay excluded`,
      );
      assert.doesNotMatch(text, /\{\{(?:characters|group)\}\}/, `${label}: identity macros resolve fully`);
    };
    const preview = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, returnPrompt: true },
    });
    assert.equal(preview.statusCode, 200, preview.body);
    check(`${mode} dry run`, preview.body);
    const peek = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
    assert.equal(peek.statusCode, 200, peek.body);
    check(`${mode} peek`, peek.body);
    const before = sent.length;
    const result = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(result.statusCode, 200, result.body);
    assert(!result.body.includes('"type":"error"'), result.body);
    assert(sent.length > before, `${mode}: generation reaches the local provider`);
    for (const text of sent.slice(before)) check(`${mode} sent prompt`, text);

    const rows = [
      { id: alpha.id, data: { name: "Alpha" } },
      { id: hidden.id, data: { name: "Hidden" } },
      { id: beta.id, data: { name: "Beta" } },
    ];
    for (const characterIds of [rosterIds, JSON.stringify(rosterIds)]) {
      const resolve = createInputMacroResolverForChat({ ...chat, characterIds, metadata }, rows, []);
      assert.equal(resolve(template), expected, `${mode}: composer uses full names and active group`);
    }
    const display = buildMessageMacroContext({
      primaryCharacter: { name: "Beta" },
      characters: rows.map((row) => ({ id: row.id, name: row.data.name })),
      inactiveCharacterIds: metadata.inactiveCharacterIds,
    });
    assert.equal(resolveMacros(template, display), "CREW: Alpha, Hidden, Beta. OTHER ACTIVE: Alpha.");
    const agent = {
      chatId: chat.id,
      chatMode: mode,
      recentMessages: [],
      mainResponse: null,
      characters: [{ id: alpha.id, name: "Alpha", description: "ALPHA_ACTIVE_CARD" }],
      chatCharacters: rows.map((row) => ({ id: row.id, name: row.data.name, active: row.id !== hidden.id })),
      persona: null,
      memory: {},
      writableLorebookIds: null,
      chatSummary: null,
    } satisfies AgentContext;
    assert.equal(
      renderAgentPromptTemplate(template, {}, agent),
      expected,
      "agent templates use names without inactive cards",
    );
    assert.equal(renderAgentPromptTemplate("{{description}}", {}, agent), "ALPHA_ACTIVE_CARD");
    await characters.update(hidden.id, { name: "Renamed" });
    const renamed = await buildPromptMacroContext({
      db,
      chatId: chat.id,
      characterIds: activeIds,
      personaName: "User",
    });
    assert.equal(resolveMacros("{{characters}}", renamed), "Alpha, Renamed, Beta");
    await chats.update(chat.id, { characterIds: activeIds });
    const removed = await buildPromptMacroContext({
      db,
      chatId: chat.id,
      characterIds: activeIds,
      personaName: "User",
    });
    assert.equal(resolveMacros("{{characters}}", removed), "Alpha, Beta");
    await characters.update(hidden.id, { name: "Hidden" });
  }
  const paddedAgent = {
    chatId: "padded-roster",
    chatMode: "roleplay",
    recentMessages: [],
    mainResponse: null,
    characters: [{ id: "alpha", name: "  Alpha & <A>  ", description: "ACTIVE_CARD" }],
    chatCharacters: [
      { id: "alpha", name: "  Alpha & <A>  ", active: true },
      { id: "empty", name: "", active: true },
      { id: "whitespace", name: "  \t ", active: true },
      { id: "hidden", name: "  Hidden & <H>  ", active: false },
      { id: "beta", name: "  Beta  ", active: true },
    ],
    persona: null,
    memory: {},
    writableLorebookIds: null,
    chatSummary: null,
  } satisfies AgentContext;
  const cleanAgent = buildAgentPromptMacroContext(paddedAgent);
  assert.deepEqual(cleanAgent.characters, ["Alpha & <A>", "Hidden & <H>", "Beta"]);
  assert.deepEqual(cleanAgent.groupCharacters, ["Alpha & <A>", "Beta"]);
  assert.equal(resolveMacros("{{characters}}|{{group}}", cleanAgent), "Alpha & <A>, Hidden & <H>, Beta|Beta");
  const escapedAgent = buildAgentPromptMacroContext(paddedAgent, { escapeValues: true });
  assert.deepEqual(escapedAgent.characters, ["Alpha &amp; &lt;A&gt;", "Hidden &amp; &lt;H&gt;", "Beta"]);
  assert.deepEqual(escapedAgent.groupCharacters, ["Alpha &amp; &lt;A&gt;", "Beta"]);
  const fallbackAgent = buildAgentPromptMacroContext({ ...paddedAgent, chatCharacters: undefined });
  assert.deepEqual(fallbackAgent.characters, ["Alpha & <A>"]);
  assert.equal(resolveMacros("{{group}}", fallbackAgent), "");
  const detached = await buildPromptMacroContext({ db, characterIds: [alpha.id], personaName: "User" });
  assert.equal(
    resolveMacros(template, detached),
    "CREW: Alpha. OTHER ACTIVE: .",
    "without a saved chat, the supplied scope is the roster",
  );
  console.info(
    "Full-roster macros preserve inactive names and exclude inactive cards across prompt and client contexts.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
}
