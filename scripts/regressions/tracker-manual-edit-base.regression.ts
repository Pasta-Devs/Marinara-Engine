// #7286: a Tracker Panel edit is the base for the next generation, including a regeneration or
// swipe of the reply it was made on. Drives the real chat and generate routes with a fake provider
// that records what the main model and the tracker agents were shown.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-tracker-edit-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const { parseGameStateRow } = await import("../../packages/server/src/routes/generate/generate-route-utils.js");

const trackerTypes = ["world-state", "character-tracker", "custom-tracker"];
let mainPrompts: string[] = [];
let trackerPrompts: string[] = [];
let trackerOutputs: Record<string, unknown> = {};
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.map((message: { content: unknown }) => JSON.stringify(message.content)).join("\n");
  const trackerType = trackerTypes.find((type) => prompt.includes(`TRACKER_FIXTURE_${type}`));
  (trackerType ? trackerPrompts : mainPrompts).push(prompt);
  const content = trackerType
    ? JSON.stringify(prompt.includes("<agent_task ") ? trackerOutputs : trackerOutputs[trackerType])
    : "The story continues.";
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});

const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const states = createGameStateStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

/** Tracker output that changes nothing, so every value falls back to the base the trackers were shown. */
const NO_CHANGES = {
  "world-state": { weather: "Rain" },
  "character-tracker": { presentCharacters: { updates: [] } },
  "custom-tracker": { updates: [] },
};
const WRONG_VALUES = {
  "world-state": { location: "Wrong place" },
  "character-tracker": { presentCharacters: { updates: [{ characterId: "alice", mood: "mood-wrong" }] } },
  "custom-tracker": { updates: [{ name: "Clue", value: "clue-wrong" }] },
};

const summarize = (row: Record<string, unknown> | null | undefined) => {
  assert.ok(row, "expected a tracker snapshot");
  const state = parseGameStateRow(row);
  return {
    location: state.location,
    mood: state.presentCharacters.find((character) => character.characterId === "alice")?.mood,
    clue: state.playerStats?.customTrackerFields?.find((field) => field.name === "Clue")?.value,
  };
};

const capture = async (run: () => Promise<void>) => {
  mainPrompts = [];
  trackerPrompts = [];
  await run();
  return { main: mainPrompts.join("\n"), trackers: trackerPrompts.join("\n") };
};

const assertShows = (prompt: string, expected: string[], stale: string[], label: string) => {
  for (const value of expected) assert.ok(prompt.includes(value), `${label} shows ${value}`);
  for (const value of stale) assert.ok(!prompt.includes(value), `${label} does not show ${value}`);
};

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  replaceBuiltInAgentDefinitions(
    trackerTypes.map((type) => ({
      id: type,
      name: type,
      description: "Synthetic tracker",
      phase: "post_processing" as const,
      enabledByDefault: false,
      category: "tracker" as const,
      defaultTools: [],
      defaultPromptTemplate: `TRACKER_FIXTURE_${type} Return JSON.`,
    })),
  );
  for (const type of trackerTypes) {
    await agents.create({
      type,
      name: type,
      phase: "post_processing",
      connectionId: connection.id,
      promptTemplate: `TRACKER_FIXTURE_${type} Return JSON.`,
    });
  }

  const api = (chatId: string) => {
    const generate = async (payload: Record<string, unknown> = {}) => {
      const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId, ...payload } });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
    };
    return {
      generate,
      regenerate: (messageId: string) => generate({ regenerateMessageId: messageId }),
      async peekRegeneration(messageId: string) {
        const response = await app.inject({
          method: "POST",
          url: "/api/generate/dryRun",
          payload: { chatId, returnPrompt: true, injectTrackers: true, regenerateMessageId: messageId },
        });
        assert.equal(response.statusCode, 200, response.body);
        return (response.json().prompt?.messages ?? [])
          .map((message: { content: string }) => message.content)
          .join("\n");
      },
      async panel() {
        const response = await app.inject({ method: "GET", url: `/api/chats/${chatId}/game-state` });
        assert.equal(response.statusCode, 200, response.body);
        return response.json();
      },
      async edit(target: { messageId: string; swipeIndex: number }, fields: Record<string, unknown>) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/chats/${chatId}/game-state`,
          payload: { ...target, ...fields, manual: true },
        });
        assert.equal(response.statusCode, 200, response.body);
      },
      async rerunTrackers(messageId: string) {
        const response = await app.inject({
          method: "POST",
          url: "/api/generate/retry-agents",
          payload: { chatId, agentTypes: trackerTypes, forMessageId: messageId },
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.ok(!response.body.includes('"type":"error"'), response.body);
      },
      async lastAssistant() {
        const message = (await chats.listMessages(chatId)).filter((entry) => entry.role === "assistant").at(-1);
        assert.ok(message);
        return message;
      },
    };
  };

  /**
   * A1 committed at Old town, then a reply A2 whose trackers wrote wrong values, which the user
   * corrected in the Tracker Panel: Right place, mood-right, clue-right.
   */
  const setUpEditedReply = async (metadata: Record<string, unknown> = {}) => {
    const chat = await chats.create({
      name: "Tracker edit",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: trackerTypes, ...metadata });
    const a1 = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "We stand in the square." });
    assert.ok(a1);
    const a1StateId = await states.create({
      chatId: chat.id,
      messageId: a1.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: "Old town",
      weather: "Clear",
      temperature: null,
      worldCustomFields: [],
      presentCharacters: [{ characterId: "alice", name: "Alice", mood: "mood-calm" } as never],
      recentEvents: [],
      personaStats: null,
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
        customTrackerFields: [{ name: "Clue", value: "clue-south" }],
      },
    });
    await states.commit(a1StateId, chat.id);
    await chats.createMessage({ chatId: chat.id, role: "user", content: "We walk on." });
    const chatApi = api(chat.id);
    trackerOutputs = WRONG_VALUES;
    if (metadata.manualTrackers) {
      await chatApi.generate();
      await chatApi.rerunTrackers((await chatApi.lastAssistant()).id);
    } else {
      await chatApi.generate();
    }
    const a2 = await chatApi.lastAssistant();
    const target = { messageId: a2.id, swipeIndex: 0 };
    assert.deepEqual(summarize(await states.getByChatAndMessage(chat.id, a2.id, 0)), {
      location: "Wrong place",
      mood: "mood-wrong",
      clue: "clue-wrong",
    });

    // The Tracker Panel edits the row it shows, one field at a time.
    const shown = await chatApi.panel();
    assert.equal(shown.messageId, a2.id);
    await chatApi.edit(target, { location: "Right place" });
    await chatApi.edit(target, {
      presentCharacters: shown.presentCharacters.map((character: { characterId: string }) =>
        character.characterId === "alice" ? { ...character, mood: "mood-right" } : character,
      ),
    });
    await chatApi.edit(target, {
      playerStats: { ...shown.playerStats, customTrackerFields: [{ name: "Clue", value: "clue-right" }] },
    });
    const edited = await chatApi.panel();
    assert.deepEqual(summarize(edited), { location: "Right place", mood: "mood-right", clue: "clue-right" });
    assert.deepEqual(
      Object.keys(edited.manualOverrides ?? {}).sort(),
      ["location", "playerStats.customTrackerFields", "presentCharacters"],
      "only the values the user changed count as edits",
    );
    return { chat, chatApi, a1, a2, target };
  };

  const EDITED = ["Right place", "mood-right", "clue-right"];
  const STALE = ["Old town", "Wrong place", "mood-wrong", "clue-wrong"];

  // ── Regenerating the edited reply starts from the edit ──
  {
    const { chat, chatApi, a1, a2 } = await setUpEditedReply();
    const a1Before = await states.getByChatAndMessage(chat.id, a1.id, 0);

    assertShows(await chatApi.peekRegeneration(a2.id), ["Right place"], STALE, "Peek Prompt for a regeneration");
    trackerOutputs = NO_CHANGES;
    const first = await capture(() => chatApi.regenerate(a2.id));
    assertShows(first.main, ["Right place"], STALE, "regeneration main prompt");
    assertShows(first.trackers, EDITED, STALE, "regeneration tracker prompts");
    assert.deepEqual(summarize(await states.getByChatAndMessage(chat.id, a2.id, 1)), {
      location: "Right place",
      mood: "mood-right",
      clue: "clue-right",
    });

    // A generation that changes a value replaces the edit on its swipe.
    trackerOutputs = { ...NO_CHANGES, "world-state": { location: "Generated place" } };
    await chatApi.regenerate(a2.id);
    assert.equal(summarize(await chatApi.panel()).location, "Generated place");

    // The edit still corrects where the reply starts, and a value the trackers leave out keeps it
    // even though the swipe just before the new one says otherwise.
    trackerOutputs = NO_CHANGES;
    const again = await capture(() => chatApi.regenerate(a2.id));
    assertShows(again.trackers, EDITED, [...STALE, "Generated place"], "a later regeneration's tracker prompts");
    assert.deepEqual(summarize(await states.getByChatAndMessage(chat.id, a2.id, 3)), {
      location: "Right place",
      mood: "mood-right",
      clue: "clue-right",
    });

    // Each swipe still shows its own state.
    await chats.setActiveSwipe(a2.id, 2);
    assert.equal(summarize(await chatApi.panel()).location, "Generated place");
    await chats.setActiveSwipe(a2.id, 0);
    assert.deepEqual(summarize(await chatApi.panel()), {
      location: "Right place",
      mood: "mood-right",
      clue: "clue-right",
    });

    // The reply before keeps its own history.
    assert.deepEqual(await states.getByChatAndMessage(chat.id, a1.id, 0), a1Before);
  }

  // ── An edit on the reply before does not contradict the regenerated reply's edit ──
  {
    const { chatApi, a1, a2 } = await setUpEditedReply();
    await chatApi.edit({ messageId: a1.id, swipeIndex: 0 }, { location: "Earlier edit" });
    trackerOutputs = NO_CHANGES;
    const regen = await capture(() => chatApi.regenerate(a2.id));
    assertShows(regen.trackers, EDITED, ["Earlier edit", ...STALE], "tracker prompts after edits on two replies");
    assert.ok(!/manualOverrides\\?":\{[^}]*[0-9a-f]{16}/.test(regen.trackers), "edit fingerprints stay out of prompts");
  }

  // ── The newest edit wins, whichever swipe it was made on ──
  {
    const { chat, chatApi, a2 } = await setUpEditedReply();
    trackerOutputs = NO_CHANGES;
    await chatApi.regenerate(a2.id);
    await chatApi.edit({ messageId: a2.id, swipeIndex: 1 }, { location: "Older place" });
    await chats.setActiveSwipe(a2.id, 0);
    await chatApi.edit({ messageId: a2.id, swipeIndex: 0 }, { location: "Newest place" });
    assertShows(
      await chatApi.peekRegeneration(a2.id),
      ["Newest place"],
      ["Older place", ...STALE],
      "a regeneration after editing two swipes",
    );
    const regen = await capture(() => chatApi.regenerate(a2.id));
    assertShows(regen.main, ["Newest place"], ["Older place", ...STALE], "the regeneration's main prompt");
    assert.equal(summarize(await states.getByChatAndMessage(chat.id, a2.id, 2)).location, "Newest place");
    // The older swipe still shows its own value.
    assert.equal(summarize(await states.getByChatAndMessage(chat.id, a2.id, 1)).location, "Older place");
  }

  // ── Clear Trackers wipes the edits on every swipe, also of a value the cleared swipe already had empty ──
  {
    const { chat, chatApi, a2, target } = await setUpEditedReply();
    trackerOutputs = NO_CHANGES;
    await chatApi.regenerate(a2.id);
    await chats.setActiveSwipe(a2.id, 0);
    await chatApi.edit(target, { temperature: "temp-hot" });
    await chats.setActiveSwipe(a2.id, 1);
    // What the Clear Trackers button sends: no target, so it clears the swipe on screen.
    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/game-state`,
      payload: {
        date: null,
        time: null,
        location: null,
        weather: null,
        temperature: null,
        worldCustomFields: [],
        presentCharacters: [],
        playerStats: { stats: [], attributes: null, skills: {}, inventory: [], activeQuests: [], status: "" },
        personaStats: [],
        manual: true,
        clearOverrides: true,
      },
    });
    assert.equal(cleared.statusCode, 200, cleared.body);
    assertShows(
      await chatApi.peekRegeneration(a2.id),
      ["Old town"],
      ["temp-hot", ...EDITED],
      "a regeneration after Clear Trackers",
    );
  }

  // ── A new message from the edited swipe starts from the edit ──
  {
    const { chat, chatApi, a2 } = await setUpEditedReply();
    trackerOutputs = NO_CHANGES;
    const next = await capture(() => chatApi.generate({ userMessage: "We look around." }));
    assertShows(next.main, ["Right place"], ["Wrong place"], "next message main prompt");
    assertShows(next.trackers, EDITED, ["Wrong place", "mood-wrong", "clue-wrong"], "next message tracker prompts");
    const a3 = await chatApi.lastAssistant();
    assert.notEqual(a3.id, a2.id);
    assert.deepEqual(summarize(await states.getByChatAndMessage(chat.id, a3.id, 0)), {
      location: "Right place",
      mood: "mood-right",
      clue: "clue-right",
    });
  }

  // ── A tracker run that keeps a value keeps its edit; one that changes it retires that edit only ──
  {
    const { chatApi, a2 } = await setUpEditedReply();
    trackerOutputs = NO_CHANGES;
    await chatApi.generate({ continueMessageId: a2.id });
    assertShows(await chatApi.peekRegeneration(a2.id), ["Right place"], STALE, "regeneration after a continuation");

    trackerOutputs = { ...NO_CHANGES, "world-state": { location: "Rerun place" } };
    await chatApi.rerunTrackers(a2.id);
    assert.equal(summarize(await chatApi.panel()).location, "Rerun place");
    assertShows(
      await chatApi.peekRegeneration(a2.id),
      ["Old town"],
      ["Right place", "Rerun place", "Wrong place"],
      "regeneration after a re-run",
    );
    // A tracker that later writes the edited value again does not bring the retired edit back.
    trackerOutputs = { ...NO_CHANGES, "world-state": { location: "Right place" } };
    await chatApi.rerunTrackers(a2.id);
    assertShows(await chatApi.peekRegeneration(a2.id), ["Old town"], ["Right place"], "a retired edit");
    trackerOutputs = NO_CHANGES;
    const regen = await capture(() => chatApi.regenerate(a2.id));
    assertShows(regen.trackers, ["mood-right", "clue-right"], ["mood-wrong", "clue-wrong"], "untouched edits");
  }

  // ── Deleting the edited swipe or reply drops the edit ──
  {
    const { chat, chatApi, a2 } = await setUpEditedReply();
    trackerOutputs = { ...NO_CHANGES, "world-state": { location: "Generated place" } };
    await chatApi.regenerate(a2.id);
    const removed = await app.inject({ method: "DELETE", url: `/api/chats/${chat.id}/messages/${a2.id}/swipes/0` });
    assert.equal(removed.statusCode, 200, removed.body);
    assertShows(
      await chatApi.peekRegeneration(a2.id),
      ["Old town"],
      ["Right place"],
      "after deleting the edited swipe",
    );

    const other = await setUpEditedReply();
    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/chats/${other.chat.id}/messages/${other.a2.id}`,
    });
    assert.equal(deleted.statusCode, 200, deleted.body);
    trackerOutputs = NO_CHANGES;
    const fresh = await capture(() => other.chatApi.generate());
    assertShows(fresh.trackers, ["Old town"], ["Right place", "mood-right", "clue-right"], "after deleting the reply");
  }

  // ── Branches carry an edit only when they include the edited reply ──
  {
    const { chat, a1, a2 } = await setUpEditedReply();
    const branch = async (upToMessageId: string) => {
      const response = await app.inject({
        method: "POST",
        url: `/api/chats/${chat.id}/branch`,
        payload: { upToMessageId },
      });
      assert.equal(response.statusCode, 200, response.body);
      const branchId = response.json().id as string;
      assert.ok(branchId);
      await chats.patchMetadata(branchId, { enableAgents: true, activeAgentIds: trackerTypes });
      return api(branchId);
    };
    trackerOutputs = NO_CHANGES;
    const before = await branch(a1.id);
    await chats.createMessage({ chatId: (await before.lastAssistant()).chatId, role: "user", content: "Elsewhere." });
    const elsewhere = await capture(() => before.generate());
    assertShows(
      elsewhere.trackers,
      ["Old town"],
      ["Right place", "mood-right", "clue-right"],
      "a branch before the edit",
    );

    const including = await branch(a2.id);
    const copied = await including.lastAssistant();
    const copiedRegen = await capture(() => including.regenerate(copied.id));
    assertShows(copiedRegen.trackers, EDITED, STALE, "a branch that includes the edited reply");
  }

  // ── Manual trackers: the regenerated swipe keeps the edit for the panel and the next message ──
  {
    const { chat, chatApi, a2 } = await setUpEditedReply({ manualTrackers: true });
    trackerPrompts = [];
    await chatApi.regenerate(a2.id);
    assert.equal(trackerPrompts.length, 0, "manual trackers do not run on their own");
    assert.deepEqual(summarize(await chatApi.panel()), {
      location: "Right place",
      mood: "mood-right",
      clue: "clue-right",
    });
    const next = await capture(() => chatApi.generate({ userMessage: "Onwards." }));
    assertShows(next.main, ["Right place"], STALE, "the next message after a manual-tracker regeneration");
    assert.equal((await chatApi.lastAssistant()).chatId, chat.id);
  }

  console.log("tracker manual edit base regression passed");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
