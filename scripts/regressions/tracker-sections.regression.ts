import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-tracker-sections-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const trackerTypes = [
  "world-state",
  "character-tracker",
  "persona-stats",
  "quest",
  "custom-tracker",
  "inventory-tracker",
  "beholder",
];
replaceBuiltInAgentDefinitions(
  trackerTypes.map((id) => ({
    id,
    name: id,
    description: "Synthetic tracker",
    phase: "post_processing",
    enabledByDefault: false,
    category: "tracker",
    defaultTools: [],
    defaultPromptTemplate: "Return JSON.",
  })),
);
let received = "";
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  received = body.messages
    .map((message: { content: unknown }) =>
      typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    )
    .join("\n");
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "The story continues." }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const presets = createPromptsStorage(db);
const states = createGameStateStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
  });
  for (const type of trackerTypes)
    await agents.create({ type, name: type, phase: "post_processing", connectionId: connection.id });
  const beholder = await agents.getByType("beholder");
  assert.ok(beholder);
  for (const wrapFormat of ["xml", "markdown", "none"] as const) {
    const preset = await presets.create({ name: `Tracker positions ${wrapFormat}`, wrapFormat });
    assert.ok(preset);
    const group = await presets.createGroup({ presetId: preset.id, name: "Saved state" });
    assert.ok(group);
    await presets.createSection({ presetId: preset.id, identifier: "start", name: "Start", content: "SECTION_START" });
    const sections = [];
    for (const type of trackerTypes) {
      const section = await presets.createSection({
        presetId: preset.id,
        identifier: type,
        name: type,
        isMarker: true,
        groupId: group.id,
        markerConfig: { type: "agent_data", agentType: type },
        content: `{{agent::${type}}}`,
      });
      assert.ok(section);
      sections.push(section);
    }
    await presets.createSection({ presetId: preset.id, identifier: "end", name: "End", content: "SECTION_END" });
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
    const chat = await chats.create({
      name: "Positions",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      activeAgentIds: trackerTypes,
      manualTrackers: true,
      gamePlayerNotes: "PLAYER_NOTE_SENTINEL",
    });
    const prior = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Earlier story." });
    await agents.saveRun({
      agentConfigId: beholder.id,
      chatId: chat.id,
      messageId: prior.id,
      result: {
        type: "beholder",
        data: { characters: [{ name: "BEHOLDER_SENTINEL", body: { head: { bare: true } } }] },
        tokensUsed: 0,
        durationMs: 1,
        success: true,
        error: null,
      },
    });
    const snapshot = {
      chatId: chat.id,
      messageId: prior.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: "WORLD_SENTINEL",
      weather: null,
      temperature: null,
      presentCharacters: [{ name: "CHARACTER_SENTINEL" }],
      recentEvents: [],
      personaStats: [{ name: "PERSONA_SENTINEL", value: 3, max: 5 }],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        status: "",
        activeQuests: [{ id: "quest", name: "QUEST_SENTINEL", objectives: [] }],
        customTrackerFields: [{ name: "CUSTOM_SENTINEL", value: "clue" }],
        inventoryTrackerInventory: [{ name: "INVENTORY_SENTINEL", qty: 2 }],
      },
    };
    const stateId = await states.create(snapshot as Parameters<typeof states.create>[0]);
    await states.commit(stateId, chat.id);
    await chats.createMessage({ chatId: chat.id, role: "user", content: "HISTORY_SENTINEL" });
    const sentinels = [
      "WORLD_SENTINEL",
      "CHARACTER_SENTINEL",
      "PERSONA_SENTINEL",
      "QUEST_SENTINEL",
      "CUSTOM_SENTINEL",
      "INVENTORY_SENTINEL",
      "BEHOLDER_SENTINEL",
    ];
    const verify = (prompt: string, positions = sentinels.map(() => "section")) => {
      assert.ok(!prompt.includes("__MARINARA_RUNTIME_AGENT_SECTION__"));
      if (wrapFormat !== "none") {
        const physicalState = wrapFormat === "xml" ? "<physical_state>" : "## Physical State";
        assert.equal(prompt.split(physicalState).length - 1, 1, "Beholder retains its Physical State wrapper");
      }
      for (const [index, sentinel] of sentinels.entries()) {
        assert.equal(
          prompt.split(sentinel).length - 1,
          positions[index] === "absent" ? 0 : 1,
          `${wrapFormat}: ${sentinel} occurs once`,
        );
        if (positions[index] === "absent") continue;
        assert.ok(prompt.indexOf(sentinel) > prompt.indexOf("SECTION_START"));
        assert.equal(
          prompt.indexOf(sentinel) < prompt.indexOf("SECTION_END"),
          positions[index] === "section",
          `${sentinel} has its requested placement`,
        );
      }
      assert.equal(prompt.split("PLAYER_NOTE_SENTINEL").length - 1, 1, "Notes stay in shared context once");
    };
    const generate = async (extra = {}) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, ...extra },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      return received;
    };
    const preview = async (extra = {}) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/dryRun",
        payload: { chatId: chat.id, returnPrompt: true, injectTrackers: true, ...extra },
      });
      assert.equal(response.statusCode, 200, response.body);
      return response
        .json()
        .prompt.messages.map((message: { content: string }) => message.content)
        .join("\n");
    };
    verify(await preview());
    verify(await generate());
    const target = (await chats.listMessages(chat.id)).filter((m) => m.role === "assistant").at(-1)!;
    const discardedId = await states.create({
      ...snapshot,
      messageId: target.id,
      location: "DISCARDED_WORLD",
    } as Parameters<typeof states.create>[0]);
    await states.commit(discardedId, chat.id);
    const regenerated = await generate({ regenerateMessageId: target.id });
    verify(regenerated);
    assert.ok(!regenerated.includes("DISCARDED_WORLD"), "Regeneration uses the previous turn's committed snapshot");
    verify(await preview({ regenerateMessageId: target.id }));
    // A disabled section, disabled group or missing marker must retain the fallback.
    await presets.updateSection(sections[0]!.id, { enabled: false });
    verify(
      await preview({ regenerateMessageId: target.id }),
      sentinels.map((_, i) => (i === 0 ? "fallback" : "section")),
    );
    await presets.updateSection(sections[4]!.id, { injectionPosition: "depth", injectionDepth: 1, groupId: null });
    const depthPreview = await preview({ regenerateMessageId: target.id });
    assert.ok(depthPreview.indexOf("CUSTOM_SENTINEL") > depthPreview.indexOf("SECTION_END"));
    assert.ok(depthPreview.indexOf("CUSTOM_SENTINEL") < depthPreview.indexOf("HISTORY_SENTINEL"));
    await presets.updateSection(sections[4]!.id, { injectionPosition: "ordered", groupId: group.id });
    await presets.updateGroup(group.id, { enabled: false });
    verify(
      await preview({ regenerateMessageId: target.id }),
      sentinels.map(() => "fallback"),
    );
    verify(
      await generate({ regenerateMessageId: target.id }),
      sentinels.map(() => "fallback"),
    );
    await presets.updateGroup(group.id, { enabled: true });
    await chats.patchMetadata(chat.id, { activeAgentIds: trackerTypes.slice(1) });
    verify(
      await preview({ regenerateMessageId: target.id }),
      sentinels.map((_, i) => (i === 0 ? "absent" : "section")),
    );
    await chats.patchMetadata(chat.id, { enableAgents: false });
    const disabled = await preview();
    for (const sentinel of [...sentinels, "PLAYER_NOTE_SENTINEL"]) assert.ok(!disabled.includes(sentinel));
  }
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Real requests and previews honor committed tracker sections, fallback placement, gating and regeneration.",
);
