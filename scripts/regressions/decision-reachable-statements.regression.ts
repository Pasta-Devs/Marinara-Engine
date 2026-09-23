/**
 * Only decision statements a turn can reach are asked, and only they count toward
 * Decision statements per turn (#6582).
 *
 * The engine's planning pass is pinned directly; then the planner's preset filter and
 * limit; then `processLorebooks` asking only about activating entries; then real
 * generate and Peek Prompt runs against a fake System One server, including the
 * choice-option statement that used to be planned under a mangled key.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-decision-reach-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { planDecisionStatements, resolveMacros, characterDataSchema, DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY } =
  await import("../../packages/shared/dist/index.js");

// ── the planning pass ─────────────────────────────────────────────────────────

const mira = { user: "User", char: "Mira", characters: ["Mira"], variables: {}, model: "gpt" } as never;
const group = {
  user: "User",
  char: "Mira",
  characters: ["Mira", "Dottore"],
  characterProfiles: [{ name: "Mira" }, { name: "Dottore" }],
  variables: {},
} as never;
const reached = (template: string, ctx = mira) => [...planDecisionStatements(template, ctx).statements];
assert.deepEqual(reached('{{#if char == "Dottore" && decision:"X"}}x{{/if}}'), [], "a fixed value rules a block out");
assert.deepEqual(reached('{{#if decision:"A" && decision:"B"}}x{{/if}}'), ["A", "B"], "every part of an && counts");
assert.deepEqual(reached('{{#if decision:"A"}}{{#if decision:"B"}}x{{/if}}{{/if}}'), ["A", "B"], "and nested blocks");
assert.deepEqual(reached('{{#if char == "Mira"}}a{{else if decision:"C"}}c{{/if}}'), [], "a settled chain stops");
assert.deepEqual(
  reached('{{setvar::mode::calm}}{{#if var:mode == "combat" && decision:"V"}}x{{/if}}'),
  ["V"],
  "a variable can change while the prompt is built, so it rules nothing out",
);
assert.deepEqual(
  reached('{{#if char == "Dottore" && decision:"G"}}x{{/if}}', group),
  ["G"],
  "in a group the character differs per section",
);
assert.deepEqual(reached('{{#if decision:"{{char}} is angry"}}x{{/if}}'), ["{{char}} is angry", "Mira is angry"]);
const variables: Record<string, string> = {};
planDecisionStatements("{{setvar::written::yes}}", { ...(mira as object), variables } as never);
assert.deepEqual(variables, {}, "a planning pass writes nothing");

// ── the planner ───────────────────────────────────────────────────────────────

const { collectTurnDecisionTexts, planPromptDecisions, reachableDecisionStatements, createLorebookDecisionResolver } =
  await import("../../packages/server/src/services/decision/prompt-decisions.js");
const block = (statement: string) => `{{#if decision:"${statement}"}}yes{{/if}}`;
const presetParts = {
  sections: [
    { content: block("In the latest message, someone draws a sword"), enabled: "true", groupId: null },
    { content: block("A disabled section asks this"), enabled: "false", groupId: null },
    { content: block("A section in a disabled group asks this"), enabled: "true", groupId: "off" },
  ],
  groups: [{ id: "off", enabled: "false" }],
  choiceBlocks: [
    {
      variableName: "tone",
      options: JSON.stringify([
        { id: "a", label: "Angry", value: block("Mira is angry in the latest message") },
        { id: "b", label: "Calm", value: block("An unselected option asks this") },
      ]),
      multiSelect: "false",
      randomPick: "false",
      separator: ", ",
    },
    {
      variableName: "weather",
      options: JSON.stringify([
        { id: "r", label: "Rain", value: block("It rains in the latest message") },
        { id: "s", label: "Snow", value: block("It snows in the latest message") },
      ]),
      multiSelect: "true",
      randomPick: "true",
      separator: ", ",
    },
  ],
  choices: {
    tone: block("Mira is angry in the latest message"),
    weather: [block("It rains in the latest message"), block("It snows in the latest message")],
  },
};
const texts = collectTurnDecisionTexts({
  preset: presetParts,
  ctx: mira,
  extra: ['{{#if char == "Dottore" && decision:"Ruled out by the character"}}x{{/if}}'],
});
const plan = (limit: number) =>
  planPromptDecisions([{ texts, ctx: mira, reachable: reachableDecisionStatements(texts, mira) }], limit);
assert.deepEqual(
  plan(32).decisions.map((decision) => decision.key),
  [
    "In the latest message, someone draws a sword",
    "Mira is angry in the latest message",
    "It rains in the latest message",
    "It snows in the latest message",
  ],
  "only reachable statements, with a choice option's statement under its real key",
);
assert.deepEqual(
  plan(2).dropped,
  ["It rains in the latest message", "It snows in the latest message"],
  "nothing unreachable takes one of the limited slots",
);

// ── processLorebooks: statements in entry text ────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { processLorebooks } = await import("../../packages/server/src/services/lorebook/index.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");

const db = await getDB();
try {
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.create({ name: "Reach lore" });
  assert(book);
  const tower = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Tower",
    content: `{{#if decision:"The tower is on fire"}}TOWER_FIRE{{else}}TOWER_CALM{{/if}}`,
    keys: ["tower"],
  } as never);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Cellar",
    content: `{{#if decision:"The cellar is flooded"}}CELLAR_FLOOD{{/if}}`,
    keys: ["cellar"],
  } as never);
  assert(tower);
  const scan = async (limit: number) => {
    const ctx = { ...(mira as object), variables: {} } as never as { decisions?: unknown };
    const asked: string[] = [];
    const dropped: string[] = [];
    const resolver = createLorebookDecisionResolver({
      macroContext: ctx as never,
      limit,
      answer: async (planned: { decisions: Array<{ key: string }> }) => {
        asked.push(...planned.decisions.map((decision) => decision.key));
        return { answers: new Map(planned.decisions.map((decision) => [decision.key, true])), choices: new Map() };
      },
      onDropped: (statement: string) => dropped.push(statement),
    });
    const result = await processLorebooks(db, [{ role: "user", content: "Smoke rises from the tower." }], null, {
      activeLorebookIds: [book.id],
      previewOnly: true,
      random: () => 0.5,
      resolveContent: (value: string) => resolveMacros(value, ctx as never),
      resolveDecisions: resolver,
    });
    return { asked, dropped, text: result.worldInfoBefore + result.worldInfoAfter };
  };
  let scanned = await scan(32);
  assert.deepEqual(scanned.asked, ["The tower is on fire"], "only the activating entry's statement is asked");
  assert.ok(scanned.text.includes("TOWER_FIRE"), "and its answer reaches the entry's text");
  scanned = await scan(0);
  assert.deepEqual(scanned.asked, [], "with no statements left this turn, nothing is asked");
  assert.deepEqual(scanned.dropped, ["The tower is on fire"], "the statement is reported as dropped");
  assert.ok(scanned.text.includes("TOWER_CALM"), "and reads as no");

  // One set of probability rolls serves the pre-scan and the real scan, so an entry
  // that activates had its statements asked, even with no Decision field in the book.
  const coin = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Coin",
    content: `{{#if decision:"The coin lands heads"}}COIN_HEADS{{else}}COIN_TAILS{{/if}}`,
    keys: ["coin"],
    probability: 50,
    useProbability: true,
  } as never);
  assert(coin);
  for (const rolls of [
    [0.9, 0.1],
    [0.1, 0.9],
  ]) {
    const coinCtx = { ...(mira as object), variables: {} } as never;
    const coinAsks: string[] = [];
    let roll = 0;
    const coinScan = await processLorebooks(db, [{ role: "user", content: "A coin spins." }], null, {
      activeLorebookIds: [book.id],
      previewOnly: true,
      random: () => rolls[roll++ % rolls.length]!,
      resolveContent: (value: string) => resolveMacros(value, coinCtx),
      resolveDecisions: createLorebookDecisionResolver({
        macroContext: coinCtx,
        limit: 32,
        answer: async (planned: { decisions: Array<{ key: string }> }) => {
          coinAsks.push(...planned.decisions.map((decision) => decision.key));
          return { answers: new Map(planned.decisions.map((decision) => [decision.key, true])), choices: new Map() };
        },
      }),
    });
    assert.equal(
      coinScan.activatedEntryIds.includes(coin.id),
      coinAsks.includes("The coin lands heads"),
      `rolls ${rolls}: asked exactly when the entry activates`,
    );
  }
  await lorebooks.removeEntry(coin.id);

  // Discovery reads every branch a decision could take, so an entry named only inside
  // another entry's decision branch is still found and asked about.
  const hinted = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Hinted",
    content: `{{#if decision:"The moss hides something"}}an ember glows{{/if}}`,
    keys: ["moss"],
    preventRecursion: false,
  } as never);
  const ember = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Ember",
    content: "EMBER_LORE",
    keys: ["ember"],
    decisionMode: "require",
    decisionStatement: "Someone tends the ember",
  } as never);
  assert(hinted && ember);
  const discoveryAsks: string[] = [];
  const discoveryCtx = { ...(mira as object), variables: {} } as never;
  const discovery = await processLorebooks(db, [{ role: "user", content: "Moss covers the stones." }], null, {
    activeLorebookIds: [book.id],
    enableRecursive: true,
    previewOnly: true,
    random: () => 0.5,
    resolveContent: (value: string) => resolveMacros(value, discoveryCtx),
    resolveDecisions: createLorebookDecisionResolver({
      macroContext: discoveryCtx,
      limit: 32,
      answer: async (planned: { decisions: Array<{ key: string }> }) => {
        discoveryAsks.push(...planned.decisions.map((decision) => decision.key));
        return { answers: new Map(planned.decisions.map((decision) => [decision.key, true])), choices: new Map() };
      },
    }),
  });
  assert.ok(discoveryAsks.includes("Someone tends the ember"), "found inside a decision branch");
  assert.ok(discovery.activatedEntryIds.includes(ember.id));
  await lorebooks.removeEntry(hinted.id);
  await lorebooks.removeEntry(ember.id);

  // ── real generate and Peek Prompt runs ──────────────────────────────────────

  const decisionBodies: Array<{ questions: Record<string, { instructions?: string }> }> = [];
  const prompts: string[] = [];
  const provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (request.url?.endsWith("/systemone")) {
      decisionBodies.push(body);
      const out: Record<string, unknown> = {};
      for (const id of Object.keys(body.questions)) out[id] = { type: "noul", noul: 0.9 };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ answers: out }));
      return;
    }
    prompts.push(JSON.stringify(body.messages ?? []));
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
  await app.register(chatsRoutes, { prefix: "/api/chats" });
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
    const character = await createCharactersStorage(db).create(
      characterDataSchema.parse({
        name: "Mira",
        description: `{{#if char == "Dottore" && decision:"Ruled out in the card"}}x{{/if}}`,
      }),
    );
    assert(character);
    const presets = createPromptsStorage(db);
    const preset = await presets.create({ name: "Reach preset", parameters: { maxTokens: 256, maxContext: 8192 } });
    assert(preset);
    await presets.createSection({
      presetId: preset.id,
      identifier: "tone",
      name: "Tone",
      content: "Tone: {{tone}}",
    } as never);
    await presets.createSection({
      presetId: preset.id,
      identifier: "off",
      name: "Disabled",
      content: block("A disabled section asks this"),
      enabled: false,
    } as never);
    await presets.createSection({
      presetId: preset.id,
      identifier: "world",
      name: "World Info",
      isMarker: true,
      markerConfig: { type: "world_info_before" },
    } as never);
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "Chat History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    } as never);
    const angry = `{{#if decision:"Mira is angry in the latest message"}}TONE_ANGRY{{else}}TONE_PLAIN{{/if}}`;
    await presets.createChoiceBlock({
      presetId: preset.id,
      variableName: "tone",
      question: "Tone?",
      options: [
        { id: "a", label: "Angry", value: angry },
        { id: "b", label: "Calm", value: block("An unselected option asks this") },
        { id: "c", label: "Plain", value: "TONE_CALM" },
      ],
    } as never);
    const chats = createChatsStorage(db);
    const chat = await chats.create({
      name: "Reach turn",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: chatConnection.id,
      promptPresetId: preset.id,
    } as never);
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      activeLorebookIds: [book.id],
      presetChoices: { tone: angry },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "Mira slams the door of the tower." },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    const asked = decisionBodies.flatMap((body) => Object.values(body.questions).map((q) => q.instructions ?? ""));
    assert.ok(
      asked.includes("Mira is angry in the latest message"),
      "a choice option's statement is asked under its real key",
    );
    assert.ok(asked.includes("The tower is on fire"), "an activating entry's statement is asked");
    for (const unreachable of [
      "A disabled section asks this",
      "An unselected option asks this",
      "The cellar is flooded",
      '\\"Mira is angry in the latest message\\"',
    ])
      assert.ok(!asked.some((text) => text.includes(unreachable)), `not asked: ${unreachable}`);
    const prompt = prompts.at(-1) ?? "";
    assert.ok(prompt.includes("TONE_ANGRY"), "and its yes reaches the prompt");
    assert.ok(prompt.includes("TOWER_FIRE"), "as does the entry's");
    assert.ok(!asked.includes("Ruled out in the card"), "a block the character rules out is not asked");

    // A pre-reply agent's plan includes the prompt's statements, filtered the same way.
    assert(
      await createAgentsStorage(db).create({
        type: "custom-reach-pre",
        name: "Reach pre",
        phase: "pre_generation",
        connectionId: chatConnection.id,
        promptTemplate: `{{#if decision:"The agent statement applies"}}AGENT_YES{{/if}}`,
        settings: { resultType: "context_injection" },
      } as never),
    );
    await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: ["custom-reach-pre"] });
    const agentFrom = decisionBodies.length;
    const agentTurn = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "Mira climbs the tower stairs." },
    });
    assert.equal(agentTurn.statusCode, 200, agentTurn.body);
    const agentAsked = decisionBodies
      .slice(agentFrom)
      .flatMap((body) => Object.values(body.questions).map((q) => q.instructions ?? ""));
    assert.ok(agentAsked.includes("The agent statement applies"), "the agent's statement is asked");
    assert.ok(!agentAsked.includes("Ruled out in the card"), "and the agent plan skips what the prompt's skips");
    await chats.patchMetadata(chat.id, { enableAgents: false, activeAgentIds: [] });

    // With nothing for the prompt itself to ask, an entry's answer still reaches the
    // preset's lorebook marker: the prompt builder holds the same answers object.
    await chats.patchMetadata(chat.id, { presetChoices: { tone: "TONE_CALM" } });
    const quiet = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "The tower still burns." },
    });
    assert.equal(quiet.statusCode, 200, quiet.body);
    assert.ok((prompts.at(-1) ?? "").includes("TONE_CALM"));
    assert.ok((prompts.at(-1) ?? "").includes("TOWER_FIRE"), "an entry's answer reaches the marker on its own");

    // Peek Prompt lists what the limit drops, apart from what is merely unanswered.
    await createAppSettingsStorage(db).set(DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY, "1");
    const peekChat = await chats.create({
      name: "Reach preview",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: chatConnection.id,
      promptPresetId: preset.id,
    } as never);
    assert(peekChat);
    await chats.patchMetadata(peekChat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      activeLorebookIds: [book.id],
      presetChoices: { tone: angry },
    });
    await chats.createMessage({ chatId: peekChat.id, role: "user", characterId: null, content: "The tower burns." });
    const peek = await app.inject({ method: "POST", url: `/api/chats/${peekChat.id}/peek-prompt`, payload: {} });
    assert.equal(peek.statusCode, 200, peek.body);
    assert.deepEqual(peek.json().decisions?.unanswered, ["Mira is angry in the latest message"]);
    assert.deepEqual(peek.json().decisions?.dropped, ["The tower is on fire"]);
    console.log("decision-reachable-statements regression passed");
  } finally {
    await app.close();
    await new Promise<void>((done) => provider.close(() => done()));
  }
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
