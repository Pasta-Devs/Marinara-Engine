import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GenerationRunner } from "../../packages/server/src/routes/generate.routes.js";
import type { RoomGameRuntime } from "../../packages/server/src/services/multiplayer/game-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-multiplayer-game-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes, parseRoomGameConfig } = await import("../../packages/server/src/routes/game.routes.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { resolveRoomGenerationPolicy, runWithRoomGeneration } =
  await import("../../packages/server/src/services/multiplayer/generation-policy.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
let runner: GenerationRunner | undefined;
let runtime: RoomGameRuntime | undefined;
await app.register(generateRoutes, {
  prefix: "/api/generate",
  onRunnerReady: (value) => {
    runner = value;
  },
});
await app.register(gameRoutes, {
  prefix: "/api/game",
  onRoomRuntimeReady: (value) => {
    runtime = value;
  },
});
const prompts: string[] = [];
let blockSetup: Promise<void> | undefined;
let setupEntered: (() => void) | undefined;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString();
  const input = JSON.parse(text);
  prompts.push(text);
  const setup = !input.stream;
  if (setup) {
    setupEntered?.();
    await blockSetup;
  }
  const content = setup
    ? JSON.stringify({
        storyArc: "Discover the harbor.",
        worldOverview: "A harbor town.",
        plotTwists: ["A sealed letter."],
        startingNpcs: [{ name: "Harbormaster", reputation: 0 }],
        characterCards: [{ name: "Reviewed Host" }, { name: "Rowan" }],
      })
    : "[Narrator][main]The harbor opens before both travellers.\n[reputation: Harbormaster, helped]\n[state: dialogue]\n[choices: Ask about the letter | Visit the docks]";
  res.writeHead(200, { "content-type": input.stream ? "text/event-stream" : "application/json" });
  if (input.stream)
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  else
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
});
try {
  await app.ready();
  assert.ok(runner && runtime);
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Room Game fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 16384,
    maxTokensOverride: 2048,
  });
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Game fixture", parameters: { maxTokens: 2048 }, wrapFormat: "xml" });
  assert.ok(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chats = createChatsStorage(db);
  const claim = { roomId: "room_fixture", epoch: "epoch_fixture", operationId: "operation_fixture" };
  const room = {
    version: 1,
    role: "host",
    roomId: claim.roomId,
    epoch: claim.epoch,
    status: "active",
    generationOperationId: claim.operationId,
    participants: [
      {
        id: "host_fixture",
        displayName: "Mari",
        persona: { name: "Reviewed Host", description: "Verbatim <host> & {{user}}." },
        isHost: true,
      },
      {
        id: "guest_fixture",
        displayName: "Alex",
        persona: { name: "Rowan", description: "A traveller." },
        isHost: false,
      },
    ],
    characters: [],
  };
  const config = parseRoomGameConfig({
    genre: "fantasy",
    setting: "A harbor",
    tone: "adventure",
    difficulty: "normal",
    playerGoals: "Find the letter",
    gmMode: "standalone",
    rating: "sfw",
    partyCharacterIds: [],
    enableAgents: false,
  });
  assert.throws(() => parseRoomGameConfig({ ...config, gameExperienceId: "fixture.experience" }));
  const chat = await chats.create({
    name: "Room Game",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { multiplayer: room, automaticSummaryEnabled: false, unrelated: "keep" });
  const setupStarted = new Promise<void>((done) => {
    setupEntered = done;
  });
  let finishSetup: (() => void) | undefined;
  blockSetup = new Promise<void>((done) => {
    finishSetup = done;
  });
  const starting = runtime.runGameStart({ chatId: chat.id, config }, claim, runner);
  await setupStarted;
  await chats.patchMetadata(chat.id, { unrelated: "changed during setup", concurrentMarker: "retained" });
  finishSetup!();
  await starting;
  blockSetup = undefined;
  setupEntered = undefined;
  assert.equal(prompts.length, 2, "one setup and one intro use the existing pipelines");
  assert.ok(
    prompts.every((prompt) => prompt.includes("Reviewed Host") && prompt.includes("Rowan")),
    "both Game prompts retain all approved humans",
  );
  assert.ok(prompts[0]!.includes("Verbatim <host> & {{user}}."));
  const meta = () => chats.getById(chat.id).then((row) => JSON.parse(row!.metadata));
  assert.equal((await meta()).gameSessionStatus, "active");
  assert.equal((await meta()).gameActiveState, "dialogue");
  assert.equal((await meta()).unrelated, "changed during setup");
  assert.equal(
    (await meta()).concurrentMarker,
    "retained",
    "setup applies on current metadata after its provider wait",
  );
  assert.equal((await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").length, 1);
  const intro = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant")!;
  const introExtra = typeof intro.extra === "string" ? JSON.parse(intro.extra) : intro.extra;
  assert.deepEqual(
    introExtra.multiplayerGameAudience,
    {
      roomId: room.roomId,
      participants: room.participants.map((participant) => ({ id: participant.id, name: participant.persona.name })),
    },
    "the existing generation commit binds Game whisper audiences to participant IDs",
  );
  assert.deepEqual(introExtra.multiplayerActor, { id: null, name: "GM", role: "gm" });
  await chats.patchMetadata(chat.id, {
    gameCharacterCards: [
      { name: "Reviewed Host", rpgStats: { attributes: [{ name: "STR", value: 20 }] } },
      { name: "Rowan", rpgStats: { attributes: [{ name: "STR", value: 8 }] } },
    ],
  });
  const { loadSkillCheckModifierContext, resolveSkillCheckWithContext } =
    await import("../../packages/server/src/services/game/skill-check-resolution.service.js");
  const dicePolicy = resolveRoomGenerationPolicy(chat.id, await meta(), [], claim)!;
  await runWithRoomGeneration(dicePolicy, async () => {
    const context = await loadSkillCheckModifierContext(db, chat.id);
    const hostCheck = resolveSkillCheckWithContext(
      context,
      { skill: "Athletics", dc: 10, who: "Reviewed Host" },
      () => 10,
    );
    const guestCheck = resolveSkillCheckWithContext(context, { skill: "Athletics", dc: 10, who: "Rowan" }, () => 10);
    assert.equal(hostCheck.total, 15);
    assert.equal(guestCheck.total, 9, "the guest check uses the guest card, never the host's STR");
    assert.equal(guestCheck.who, "Rowan");
    assert.throws(() =>
      resolveSkillCheckWithContext(context, { skill: "Athletics", dc: 10, who: "Unapproved stranger" }, () => 10),
    );
  });
  await runtime.runGameStart({ chatId: chat.id, config }, claim, runner);
  assert.equal(prompts.length, 2, "a late startup call cannot regenerate the intro");
  assert.deepEqual(await runtime.finishGameTurn(chat.id, claim), { applied: false });
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
  const characters = createCharactersStorage(db);
  const companion = await characters.create(characterDataSchema.parse({ name: "Élodie" }));
  const gm = await characters.create(characterDataSchema.parse({ name: "Keeper" }));
  assert.ok(companion && gm);
  const approvedRoom = {
    ...room,
    characters: [
      { id: companion.id, name: "Élodie", role: "character" },
      { id: gm.id, name: "Keeper", role: "gm" },
    ],
  };
  await chats.patchMetadata(chat.id, {
    multiplayer: approvedRoom,
    gameGmCharacterId: gm.id,
    gamePartyCharacterIds: ["npc:harbormaster", "npc:untracked", "private_library_card"],
  });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "[Narrator][main]The party gathers.\n[party_add: elodie]\n[party_add: keeper]",
  });
  await runtime.finishGameTurn(chat.id, claim);
  assert.deepEqual(
    (await meta()).gamePartyCharacterIds,
    ["npc:harbormaster", companion.id],
    "party matching retains tracked NPCs and normalized approved cards, but excludes the GM and unapproved IDs",
  );
  const ambiguousCompanion = await characters.create(characterDataSchema.parse({ name: "Elodie" }));
  assert.ok(ambiguousCompanion);
  await chats.patchMetadata(chat.id, {
    multiplayer: {
      ...approvedRoom,
      characters: [
        ...approvedRoom.characters,
        { id: ambiguousCompanion.id, name: "Another companion", role: "character" },
      ],
    },
    gamePartyCharacterIds: [],
  });
  await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[party_add: elodie]" });
  await runtime.finishGameTurn(chat.id, claim);
  assert.deepEqual(
    (await meta()).gamePartyCharacterIds,
    [],
    "a library rename cannot recruit an ambiguous normalized name",
  );
  for (const route of ["start", "setup"]) {
    const denied = await app.inject({ method: "POST", url: `/api/game/${route}`, payload: { chatId: chat.id } });
    assert.equal(denied.statusCode, 409, "live room Games cannot be driven by the single-player controller");
  }
  const repairedSetup = await app.inject({
    method: "POST",
    url: "/api/game/setup/apply-json",
    payload: { chatId: chat.id, rawJson: "{}" },
  });
  assert.equal(
    repairedSetup.statusCode,
    409,
    "setup repair cannot bypass the room coordinator or load private persona context",
  );
  const protectedRoomState = {
    multiplayerSetup: true,
    multiplayerSetupComplete: true,
    multiplayerCharacterMemories: { [companion.id]: [{ from: "Keeper", summary: "Current memory." }] },
    multiplayerGameAppliedMessages: (await meta()).multiplayerGameAppliedMessages,
    multiplayerGameTurn: (await meta()).multiplayerGameTurn,
  };
  await chats.patchMetadata(chat.id, protectedRoomState);
  const policy = resolveRoomGenerationPolicy(chat.id, await meta(), [], claim)!;
  await runWithRoomGeneration(policy, () =>
    chats.updateMetadata(chat.id, {
      ...Object.fromEntries(Object.keys(protectedRoomState).map((key) => [key, null])),
      multiplayer: { ...room, status: "ended" },
      unrelated: "updated",
    }),
  );
  assert.equal((await meta()).multiplayer.status, "active", "generation cannot overwrite coordinator metadata");
  for (const [key, expected] of Object.entries(protectedRoomState))
    assert.deepEqual((await meta())[key], expected, `${key} survives a stale full snapshot`);
  await runWithRoomGeneration(policy, () =>
    chats.patchMetadataWithCharacterIds(chat.id, () => ({
      metadata: { multiplayerGameAppliedMessages: [], multiplayerCharacterMemories: {}, multiplayerSetup: false },
      characterIds: [companion.id, gm.id],
    })),
  );
  for (const [key, expected] of Object.entries(protectedRoomState))
    assert.deepEqual((await meta())[key], expected, `${key} survives a character-ID snapshot`);
  const { handleConversationSideEffectCommand } =
    await import("../../packages/server/src/services/generation/conversation-side-effect-command-runtime.js");
  await runWithRoomGeneration(policy, () =>
    handleConversationSideEffectCommand({
      command: { type: "memory", target: "Keeper", summary: "A fresh room memory." },
      characterId: companion.id,
      chatId: chat.id,
      chars: characters,
      chats,
    }),
  );
  assert.equal(
    (await meta()).multiplayerCharacterMemories[gm.id][0].summary,
    "A fresh room memory.",
    "the explicit memory writer retains its narrow room key",
  );
  await chats.patchMetadata(chat.id, { multiplayer: { ...room, status: "ended" } });
  await assert.rejects(
    runWithRoomGeneration(policy, () => chats.updateMetadata(chat.id, { multiplayer: room, unrelated: "stale" })),
    /room generation authority is no longer active/,
  );
  assert.equal((await meta()).unrelated, "updated", "stale generation writes are refused");

  const stopped = await chats.create({
    name: "Interrupted setup",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert.ok(stopped);
  await chats.patchMetadata(stopped.id, { multiplayer: room });
  const controller = new AbortController();
  const entered = new Promise<void>((done) => {
    setupEntered = done;
  });
  let release: (() => void) | undefined;
  blockSetup = new Promise<void>((done) => {
    release = done;
  });
  const pending = runtime.runGameStart(
    { chatId: stopped.id, config },
    { ...claim, signal: controller.signal },
    runner,
    controller.signal,
  );
  await entered;
  controller.abort();
  release!();
  await assert.rejects(pending);
  assert.equal((await chats.listMessages(stopped.id)).length, 0, "Stop during setup cannot issue the intro");
  assert.equal(JSON.parse((await chats.getById(stopped.id))!.metadata).gameSessionStatus, "setup");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Multiplayer Game runtime regression passed.\n");
