/**
 * Package turn games a character starts by tag (Capability API 1.827): a game the Engine does not know by name
 * (Blackjack, Wordle) gets a Commands toggle from the catalog, a character prompt line while it is on, and the
 * config its package's start hook gives the game the tag starts.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnyTurnGameEngine } from "../../../packages/shared/src/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-turn-game-commands-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
// The server reads `@marinara-engine/shared` from dist, and the engine registry is module state, so the test
// registers its engines in that same module.
const { registerTurnGameEngine, characterDataSchema } = await import("../../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { registerCapabilityConversationCommand } =
  await import("../../../packages/server/src/services/capability-packages/capability-command-registry.service.js");
const { buildConversationCommandsReminder } =
  await import("../../../packages/server/src/services/generation/conversation-command-runtime.js");
const { handleTurnGameCommand } =
  await import("../../../packages/server/src/services/generation/turn-game-command-runtime.js");
const { getActiveTurnGame } =
  await import("../../../packages/server/src/services/turn-games/turn-game-runner.service.js");
const { createGenerationEventSink } = await import("../../../packages/server/src/routes/generate/sse.js");
const { turnGamesRoutes } = await import("../../../packages/server/src/routes/turn-games.routes.js");
const { buildConversationCommandToggleOptions } =
  await import("../../../packages/client/src/features/chat-settings/lib/conversation-command-toggles.js");

type FakeState = { config: unknown; seats: string[] };

function fakeEngine(gameType: string, label: string, maxPlayers: number): AnyTurnGameEngine {
  return {
    gameType,
    schemaVersion: 1,
    label,
    minPlayers: 1,
    maxPlayers,
    hiddenInformation: false,
    defaultConfig: () => ({ from: "default" }),
    normalizeConfig: (config: unknown) => (config && typeof config === "object" ? config : { from: "default" }),
    setup: (config: unknown, seats: Array<{ seatId: string }>): FakeState => ({
      config,
      seats: seats.map((seat) => seat.seatId),
    }),
    currentSeat: (state: FakeState) => state.seats[0] ?? null,
    isTerminal: () => ({ done: false }),
    publicView: (state: FakeState) => state,
  } as unknown as AnyTurnGameEngine;
}

const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const cleanups: Array<() => void> = [];
const startContexts: unknown[] = [];
let declinedChatId = "";
let soloChatId = "";
let silentHookChatId = "";
let throwingHookChatId = "";

cleanups.push(registerTurnGameEngine(fakeEngine("duel-match", "Duel Match", 2)));
cleanups.push(registerTurnGameEngine(fakeEngine("card-table", "Card Table", 4)));
cleanups.push(registerTurnGameEngine(fakeEngine("uno", "UNO", 8)));
cleanups.push(registerTurnGameEngine(fakeEngine("daily-puzzle", "Daily Puzzle", 1)));
cleanups.push(registerCapabilityConversationCommand({ commandType: "duel_match", tags: ["duel_match"] }));
cleanups.push(registerCapabilityConversationCommand({ commandType: "daily_puzzle", tags: ["daily_puzzle"] }));
cleanups.push(
  registerCapabilityConversationCommand({
    commandType: "card_table",
    tags: ["card_table", "cards"],
    toggle: { label: "Cards", description: "Let characters deal you in." },
    startConfig: (context) => {
      startContexts.push(context);
      if (context.chatId === declinedChatId) return null;
      if (context.chatId === soloChatId) return { botCharacterIds: [] };
      // A JavaScript package can return nothing at all.
      if (context.chatId === silentHookChatId) return undefined as never;
      if (context.chatId === throwingHookChatId) throw new Error("the package's hook broke");
      return { config: { chatId: context.chatId }, botCharacterIds: context.botCharacterIds.slice(1) };
    },
  }),
);
// UNO keeps its built-in toggle and line, and a command that starts no game gets neither.
cleanups.push(registerCapabilityConversationCommand({ commandType: "uno", tags: ["uno"] }));
cleanups.push(registerCapabilityConversationCommand({ commandType: "phone", tags: ["phone"] }));

const mira = await characters.create(characterDataSchema.parse({ name: "Mira" }));
const kaelen = await characters.create(characterDataSchema.parse({ name: "Kaelen" }));

async function conversationChat(name: string) {
  const chat = await chats.create({ name, mode: "conversation", characterIds: [mira.id, kaelen.id] });
  assert.ok(chat);
  return chat;
}

function reminder(chatId: string, chatMeta: Record<string, unknown>, chatMode: "conversation" | "roleplay") {
  return buildConversationCommandsReminder({
    enabled: true,
    chatMode,
    chatMeta,
    characterIds: [mira.id, kaelen.id],
    personaName: "Romu",
    chatId,
    musicPlayerEnabled: false,
    chats: { list: async () => [] },
    chars: { getById: async () => null },
    agentsStore: {} as never,
    db,
    wrapFormat: "none",
    resolvePromptMacros: (value) => value,
  });
}

function startFromTag(commandType: string, chatId: string, chatMeta: Record<string, unknown>) {
  const events: unknown[] = [];
  return handleTurnGameCommand({
    commandType,
    characterId: mira.id,
    chatId,
    chatMeta,
    db,
    chats,
    conn: null,
    baseUrl: "",
    reply: createGenerationEventSink({ onEvent: (event) => events.push(event), onFinish: () => {} }),
    signal: new AbortController().signal,
  });
}

const cases: RegressionCase[] = [
  {
    name: "Chat Settings shows a toggle for each package game after the installed built-in commands",
    run() {
      const options = buildConversationCommandToggleOptions(new Set(["uno"]), [
        { commandType: "blackjack", label: "Blackjack", description: null },
        { commandType: "wordle", label: "Wordle", description: "Let characters start today's Wordle." },
      ]);
      const ids = options.map((option) => option.id);
      assert.ok(ids.includes("uno"));
      assert.ok(!ids.includes("chess"), "a built-in game whose package is missing stays hidden");
      assert.deepEqual(ids.slice(-2), ["blackjack", "wordle"]);
      assert.deepEqual(options.at(-2), {
        id: "blackjack",
        label: "Blackjack",
        description: "Let characters start a game of Blackjack when you agree to play.",
        descriptionKey: "ui.chat.conversationcommands.packageGameDescription",
        descriptionValues: { game: "Blackjack" },
      });
      assert.deepEqual(options.at(-1), {
        id: "wordle",
        label: "Wordle",
        description: "Let characters start today's Wordle.",
      });
    },
  },
  {
    name: "the catalog lists each package game's toggle, but not built-in games or commands that start no game",
    async run() {
      const app = Fastify();
      try {
        await app.register(turnGamesRoutes, { prefix: "/api/turn-games" });
        const response = await app.inject({ method: "GET", url: "/api/turn-games/catalog" });
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json().commands, [
          { commandType: "duel_match", label: "Duel Match", description: null },
          { commandType: "daily_puzzle", label: "Daily Puzzle", description: null },
          { commandType: "card_table", label: "Cards", description: "Let characters deal you in." },
        ]);
      } finally {
        await app.close();
      }
    },
  },
  {
    name: "characters are told a package game's tag only while its toggle is on and in Conversation mode",
    async run() {
      const chat = await conversationChat("prompt line");
      const on = (await reminder(chat.id, {}, "conversation")) ?? "";
      assert.match(on, /- \[duel_match\] - start a one-on-one game of Duel Match against Romu\./);
      assert.match(on, /Agreeing to play IS including \[duel_match\]\./);
      assert.match(on, /- \[card_table\] - start a game of Card Table at the table\./);
      assert.doesNotMatch(on, /\[phone\]/);

      // A one-seat game says the persona plays alone, and still keeps the model from narrating the board.
      const solo = on.split("\n").find((line) => line.startsWith("- [daily_puzzle]")) ?? "";
      assert.match(solo, /Daily Puzzle seats only Romu/);
      assert.match(solo, /do NOT describe the board or narrate moves/);
      assert.doesNotMatch(solo, /opponent|characters who are around|against Romu/);

      const duelOff =
        (await reminder(chat.id, { conversationCommandToggles: { duel_match: false } }, "conversation")) ?? "";
      assert.doesNotMatch(duelOff, /\[duel_match\]/);
      assert.match(duelOff, /\[card_table\]/);

      assert.doesNotMatch(
        (await reminder(chat.id, {}, "roleplay")) ?? "",
        /\[duel_match\]|\[card_table\]|\[daily_puzzle\]/,
      );
    },
  },
  {
    name: "a tag starts the game with the config its package's start hook returns",
    async run() {
      const chat = await conversationChat("start hook");
      assert.equal(await startFromTag("card_table", chat.id, { conversationTimeZone: "Asia/Manila" }), true);

      assert.deepEqual(startContexts.at(-1), {
        chatId: chat.id,
        characterId: mira.id,
        botCharacterIds: [mira.id, kaelen.id],
        humanSeatId: "human",
        timeZone: "Asia/Manila",
      });
      const game = await getActiveTurnGame(db, chat.id);
      assert.equal(game?.engine.gameType, "card-table");
      assert.deepEqual(game?.state, { config: { chatId: chat.id }, seats: ["human", kaelen.id] });

      // With a game running, no character is offered another one.
      assert.doesNotMatch(
        (await reminder(chat.id, {}, "conversation")) ?? "",
        /\[duel_match\]|\[card_table\]|\[daily_puzzle\]/,
      );
    },
  },
  {
    name: "a one-seat game's tag starts it with the player alone, not every character in the chat",
    async run() {
      const chat = await conversationChat("one seat");
      assert.equal(await startFromTag("daily_puzzle", chat.id, {}), true);
      const game = await getActiveTurnGame(db, chat.id);
      assert.equal(game?.engine.gameType, "daily-puzzle");
      assert.deepEqual(game?.state, { config: { from: "default" }, seats: ["human"] });
    },
  },
  {
    name: "a start hook that returns null keeps the game from starting",
    async run() {
      const chat = await conversationChat("declined");
      declinedChatId = chat.id;
      assert.equal(await startFromTag("card_table", chat.id, {}), true);
      assert.equal(await getActiveTurnGame(db, chat.id), null);
    },
  },
  {
    name: "a start hook's empty seat list starts the game with the player alone, not every character",
    async run() {
      const chat = await conversationChat("solo");
      soloChatId = chat.id;
      assert.equal(await startFromTag("card_table", chat.id, {}), true);
      const game = await getActiveTurnGame(db, chat.id);
      assert.deepEqual(game?.state, { config: { from: "default" }, seats: ["human"] });
    },
  },
  {
    name: "a start hook that returns nothing leaves the start as it was",
    async run() {
      const chat = await conversationChat("silent hook");
      silentHookChatId = chat.id;
      assert.equal(await startFromTag("card_table", chat.id, {}), true);
      const game = await getActiveTurnGame(db, chat.id);
      assert.deepEqual(game?.state, { config: { from: "default" }, seats: ["human", mira.id, kaelen.id] });
    },
  },
  {
    name: "a start hook that throws keeps the game from starting without failing the reply",
    async run() {
      const chat = await conversationChat("throwing hook");
      throwingHookChatId = chat.id;
      assert.equal(await startFromTag("card_table", chat.id, {}), true);
      assert.equal(await getActiveTurnGame(db, chat.id), null);
    },
  },
  {
    name: "a game without a start hook starts with its engine's default config",
    async run() {
      const chat = await conversationChat("default config");
      assert.equal(await startFromTag("duel_match", chat.id, {}), true);
      const game = await getActiveTurnGame(db, chat.id);
      assert.deepEqual(game?.state, { config: { from: "default" }, seats: ["human", mira.id] });
    },
  },
];

try {
  await runNamedCases(cases);
} finally {
  for (const cleanup of cleanups.reverse()) cleanup();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
