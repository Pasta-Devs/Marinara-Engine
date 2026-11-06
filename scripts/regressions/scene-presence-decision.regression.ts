/**
 * Automated active characters for Merged Roleplay groups: the choosing rules.
 *
 * Pins keep their state, the narrator stays active, nobody-active and no-change leave the
 * chat alone, and both sources (Decision model answers, Character Tracker present list)
 * report "no data" as null rather than "nobody here". Then real generate runs prove the
 * wiring: the Decision model sets the list, a pin holds, a failing Decision model falls back
 * to the tracker's last scene, and with the setting off or in Individual mode nothing is asked.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-scene-presence-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { chooseSceneCharacters, presentFromDecision, presentFromTracker, scenePresenceQuestions, scenePresenceState } =
  await import("../../packages/server/src/services/generation/scene-presence-decision.js");

const ids = ["narrator", "logan", "kurt", "rogue"];
const choose = (overrides: Partial<Parameters<typeof chooseSceneCharacters>[0]> = {}) =>
  chooseSceneCharacters({
    candidateIds: ids,
    presentIds: ["logan"],
    currentInactiveIds: [],
    pinnedIds: [],
    narratorId: "narrator",
    ...overrides,
  });

// ── choosing ────────────────────────────────────────────────────────────────────

assert.deepEqual(choose(), ["kurt", "rogue"], "absent characters go inactive; the narrator stays active");
assert.deepEqual(
  choose({ currentInactiveIds: ["logan", "kurt", "rogue"], presentIds: ["kurt"] }),
  ["logan", "rogue"],
  "an entering character comes back, a leaving one goes",
);
assert.deepEqual(
  choose({ pinnedIds: ["rogue"], currentInactiveIds: [] }),
  ["kurt"],
  "a pinned active character stays active although absent",
);
assert.deepEqual(
  choose({ pinnedIds: ["logan"], currentInactiveIds: ["logan"], presentIds: ["logan", "kurt"] }),
  ["logan", "rogue"],
  "a pinned inactive character stays inactive although present",
);
assert.equal(choose({ presentIds: null }), null, "no source answered: leave the chat alone");
assert.equal(choose({ currentInactiveIds: ["rogue", "kurt"] }), null, "no change: no write");
assert.equal(
  choose({ narratorId: null, presentIds: [] }),
  null,
  "without a narrator, a choice that leaves nobody active is dropped",
);
assert.deepEqual(
  choose({ narratorId: null, presentIds: ["kurt"] }),
  ["narrator", "logan", "rogue"],
  "without a narrator every character follows the scene",
);
assert.deepEqual(choose({ presentIds: [] }), ["logan", "kurt", "rogue"], "an empty scene keeps only the narrator");

// ── sources ─────────────────────────────────────────────────────────────────────

const asked = ["logan", "kurt", "rogue"];
assert.equal(presentFromDecision(new Map(), 0.5, asked), null, "no answers is no data");
assert.deepEqual(
  presentFromDecision(
    new Map([
      ["logan", 0.9],
      ["kurt", 0.5],
      ["rogue", 0.2],
    ]),
    0.5,
    asked,
  ),
  ["logan", "kurt"],
  "answers at or over the threshold are present",
);
assert.equal(
  presentFromDecision(
    new Map([
      ["logan", 0.9],
      ["kurt", 0.9],
    ]),
    0.5,
    asked,
  ),
  null,
  "a partial answer is no data: an unanswered character is not turned off",
);

const identities = [
  { id: "narrator", name: "Narrator", nameAliases: [] },
  { id: "logan", name: "Logan", nameAliases: ["Wolverine"] },
  { id: "kurt", name: "Kurt Wagner", nameAliases: ["Nightcrawler", "Kurt"] },
  { id: "rogue", name: "Rogue", nameAliases: ["Kurt"] },
];
assert.equal(presentFromTracker(undefined, identities), null, "no tracker list is no data");
assert.equal(
  presentFromTracker([], identities),
  null,
  "an empty tracker list is no data, as the tracker merge treats it",
);
assert.deepEqual(
  presentFromTracker(
    [{ characterId: "kurt", name: "Kurt" }, { characterId: "npc-guard", name: "Guard" }, { name: "No id" }, null],
    identities,
  ),
  ["kurt"],
  "an attached id counts; NPCs and unmatched names are skipped",
);
assert.deepEqual(
  presentFromTracker([{ characterId: "npc-rogue", name: "rogue" }], identities),
  ["rogue"],
  "a card that walked in while inactive is found by its name under the made-up id",
);
assert.deepEqual(
  presentFromTracker([{ characterId: "Logan", name: "" }], identities),
  ["logan"],
  "a name written as the id is found",
);
assert.deepEqual(
  presentFromTracker([{ characterId: "npc-1", name: "Wolverine" }], identities),
  ["logan"],
  "a card's name alias is found",
);
assert.deepEqual(
  presentFromTracker([{ characterId: "LOGAN:cast:jean grey", name: "Jean Grey" }], identities),
  ["logan"],
  "a cast member's id points at its card",
);
assert.equal(
  presentFromTracker([{ characterId: "npc-2", name: "Kurt" }], identities),
  null,
  "an alias two cards share matches neither; with nothing else listed, that is no data",
);
assert.equal(
  presentFromTracker([{ characterId: "npc-guard", name: "Guard" }], identities),
  null,
  "a list naming no attached character is no data: NPCs only and wrong ids look the same",
);

const { decideSceneCharacters } =
  await import("../../packages/server/src/services/generation/scene-presence.service.js");
const unreadable = await decideSceneCharacters({
  mode: "tracker",
  chatId: "chat",
  candidateIds: ids,
  trackedPresentCharacters: [{ characterId: "kurt", name: "Kurt" }],
  // No card could be read, as with a missing row or a card with no name.
  loadIdentities: async () => [],
  currentInactiveIds: [],
  pinnedIds: [],
  narratorId: "narrator",
  getBackend: async () => null,
  loadCandidates: async () => [],
  buildTranscript: () => [],
});
assert.deepEqual(
  unreadable.inactiveIds,
  ["logan", "rogue"],
  "a card whose name could not be read still matches by its id",
);

// ── questions and state ─────────────────────────────────────────────────────────

const candidates = [
  { id: "logan", name: "Logan", about: "x".repeat(1000) },
  { id: "kurt", name: "Kurt" },
];
const questions = scenePresenceQuestions(candidates);
assert.deepEqual(
  questions.map((question) => question.id),
  ["logan", "kurt"],
  "one question per candidate, keyed by id",
);
assert.match(questions[0]!.instructions, /^Logan is physically present/, "the question names the character");

const state = scenePresenceState(
  [
    { role: "user", name: "Ylli", content: "I wave Kurt over." },
    { role: "assistant", name: "Narrator", content: "Logan grunts." },
  ],
  candidates,
  ["Logan"],
  4000,
);
assert(state, "a small cast fits the state");
assert.deepEqual(state.last_tracked_present, ["Logan"], "the tracker's last scene is in the state");
assert.equal(
  (state.candidates as Array<{ about?: string }>)[0]!.about!.length,
  300,
  "a long card is cut so it cannot crowd out the transcript",
);
assert.equal((state.recent_messages as unknown[]).length, 2, "the transcript is in the state");
assert.equal(
  "last_tracked_present" in scenePresenceState([], candidates, [], 4000)!,
  false,
  "no tracker data, no empty field",
);

const bigCast = Array.from({ length: 40 }, (_, index) => ({
  id: `c${index}`,
  name: `Character ${index}`,
  about: "y".repeat(300),
}));
const squeezed = scenePresenceState([{ role: "user", content: "Hello." }], bigCast, [], 1000);
assert(squeezed, "a big cast still fits with shorter cards");
assert(
  (squeezed.candidates as Array<{ about?: string }>).every((candidate) => (candidate.about?.length ?? 0) <= 100),
  "a big cast drops to shorter cards rather than starving the transcript",
);
assert.equal(
  scenePresenceState([], bigCast, [], 300),
  null,
  "when even the names leave no room for the transcript, the Decision model is not asked",
);

// ── the real route ─────────────────────────────────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

let probabilities: Record<string, number> = {};
let decisionFails = false;
const decisionCalls: string[][] = [];
let lastDecisionState: { recent_messages?: Array<{ role: string; name?: string }> } = {};

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/systemone")) {
    decisionCalls.push(Object.keys(body.questions ?? {}));
    lastDecisionState = body.state ?? {};
    if (decisionFails) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture decision failure" }));
      return;
    }
    const out: Record<string, { type: "noul"; noul: number }> = {};
    for (const id of Object.keys(body.questions ?? {})) out[id] = { type: "noul", noul: probabilities[id] ?? 0 };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers: out }));
    return;
  }
  const content = "The scene goes on.";
  if (!body.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });

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
  const decision = await connections.create({
    name: "Decision fixture",
    provider: "decision",
    decisionSource: "custom",
    baseUrl,
    model: "jev-latest",
    maxStateTokens: 3500,
    defaultForAgents: true,
  });
  assert(decision);

  const characters = createCharactersStorage(db);
  const cast = await Promise.all(
    ["Narrator", "Logan", "Kurt", "Rogue"].map((name) =>
      characters.create(
        characterDataSchema.parse({ name, extensions: name === "Rogue" ? { nameAliases: ["Anna Marie"] } : {} }),
      ),
    ),
  );
  assert(cast.every(Boolean));
  const [narrator, logan, kurt, rogue] = (cast as Array<{ id: string }>).map((character) => character.id);

  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Scene fixture", parameters: { maxTokens: 256, maxContext: 8192 } });
  assert(preset);
  await presets.createSection({ presetId: preset.id, identifier: "rules", name: "Rules", content: "Narrate." });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });

  const chat = await chats.create({
    name: "Scene proof",
    mode: "roleplay",
    characterIds: [narrator!, logan!, kurt!, rogue!],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    groupChatMode: "merged",
    roleplayCommandNarratorId: narrator,
    autoActiveCharacters: "decision",
  });

  const turn = async (text: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: text },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    return response.body;
  };
  const inactive = async () => {
    const metadata = JSON.parse(String((await chats.getById(chat.id))!.metadata));
    return [...(metadata.inactiveCharacterIds ?? [])].sort();
  };

  // 1. The Decision model sets the cast; the narrator stays active.
  probabilities = { [narrator!]: 0, [logan!]: 0.95, [kurt!]: 0.05, [rogue!]: 0.9 };
  const body = await turn("Logan and Rogue argue in the hangar.");
  assert.equal(decisionCalls.length, 1, "one batched decision request");
  assert.deepEqual(await inactive(), [kurt!], "Kurt is not in the scene");
  assert.match(body, /"inactiveCharacterIds"/u, "the client gets the change live");

  // 2. A pinned character keeps its state whatever the Decision model says.
  await chats.patchMetadata(chat.id, { autoActiveCharacterPins: [kurt!] });
  probabilities = { [narrator!]: 0, [logan!]: 0.95, [kurt!]: 0.95, [rogue!]: 0.05 };
  await turn("Kurt teleports in.");
  const replies = (lastDecisionState.recent_messages ?? []).filter((message) => message.role === "assistant");
  assert(replies.length > 0, "the transcript includes the last reply");
  // Merged replies are saved under the first character's id; naming them by it would claim that character spoke.
  assert(
    replies.every((message) => message.name === "the narrator"),
    "merged replies are the narrator's",
  );
  assert.deepEqual(await inactive(), [kurt!, rogue!].sort(), "pinned Kurt stays inactive, Rogue leaves");
  await chats.patchMetadata(chat.id, { autoActiveCharacterPins: [] });

  // 3. A failing Decision model falls back to the tracker's last scene.
  const lastAssistant = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1)!;
  const stateStore = createGameStateStorage(db);
  const stateId = await stateStore.create({
    chatId: chat.id,
    messageId: lastAssistant.id,
    swipeIndex: 0,
    date: null,
    time: null,
    location: "Hangar",
    weather: null,
    temperature: null,
    worldCustomFields: [],
    presentCharacters: [
      // Rogue as the tracker lists a card that walked in while inactive: an NPC id and her alias.
      { characterId: "npc-anna-marie", name: "Anna Marie", mood: "calm" },
      { characterId: "npc-guard", name: "Guard", mood: "bored" },
    ],
    recentEvents: [],
    personaStats: null,
    playerStats: null,
  } as never);
  await stateStore.commit(stateId, chat.id);
  decisionFails = true;
  await turn("Who is still here?");
  assert.deepEqual(await inactive(), [logan!, kurt!].sort(), "the tracker saw only Rogue");
  decisionFails = false;

  // 4. Off, or Individual mode: nothing is asked and nothing changes.
  const asked = decisionCalls.length;
  await chats.patchMetadata(chat.id, { autoActiveCharacters: "off" });
  await turn("Quiet.");
  await chats.patchMetadata(chat.id, { autoActiveCharacters: "decision", groupChatMode: "individual" });
  await turn("Still quiet.");
  assert.equal(decisionCalls.length, asked, "no decision request when off or in Individual mode");
  assert.deepEqual(await inactive(), [logan!, kurt!].sort(), "the list is untouched");

  console.log("scene-presence-decision regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
