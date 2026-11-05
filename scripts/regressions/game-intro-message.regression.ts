/**
 * The Game Master's intro message (Capability API 1.339), part of the GM setup:
 *
 *   - Defined: the game's first message is exactly the text set, written by no model.
 *   - Guided: the Game Master writes the first message, told the guidance; only on the opening reply.
 *   - An Experience's story may set one; locked, the player's setup cannot change it; unlocked, the
 *     player's own (or `{ mode: "none" }`) wins.
 *   - An Experience package's own GM setup values (1.372), its intro among them, kept with the game as
 *     `gameExperienceIntro` and read before its story's.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import {
  gameIntroChoiceSchema,
  gameIntroFor,
  gameIntroGuidanceText,
  gameIntroSchema,
  readGameIntroChoice,
  experienceSetupDefaultsSchema,
  storyCapabilityMinor,
  storyScriptSchema,
} from "../../packages/shared/src/index.js";

// ── What an intro may be ──
assert.ok(gameIntroSchema.safeParse({ mode: "defined", text: '[Mira] [main] [smile]: "Welcome."\n\nRain.' }).success);
assert.ok(!gameIntroSchema.safeParse({ mode: "guided", text: "Open on [bg: x]" }).success, "guidance has no tags");
assert.ok(!gameIntroSchema.safeParse({ mode: "guided", text: "{{user}} wakes" }).success, "nor macros");
assert.ok(!gameIntroSchema.safeParse({ mode: "defined", text: "   " }).success, "nor nothing");
assert.ok(gameIntroChoiceSchema.safeParse({ mode: "none" }).success);
assert.equal(readGameIntroChoice({ mode: "sideways" }), null);
// An Experience's GM setup values (1.372): any of the wizard's fields, the intro the only one that locks.
assert.ok(experienceSetupDefaultsSchema.safeParse({ setting: "Sallowmarch", tone: ["Dark"], rating: "sfw" }).success);
assert.ok(!experienceSetupDefaultsSchema.safeParse({ genre: ["Fantasy, Horror"] }).success, "one genre each");
assert.ok(!experienceSetupDefaultsSchema.safeParse({ difficulty: "Nightmare" }).success);
assert.ok(!experienceSetupDefaultsSchema.safeParse({ setting: "x", locked: true }).success, "only the intro locks");

// ── Whose intro the game opens with ──
const creator = { mode: "defined" as const, text: "The bells have stopped." };
const locked = { ...creator, locked: true };
const player = { mode: "guided" as const, text: "Open in the market at dawn." };
assert.deepEqual(gameIntroFor(creator, null), creator, "the Experience's own, when the setup chose none");
assert.deepEqual(gameIntroFor(creator, player), player, "unlocked: the player's wins");
assert.equal(gameIntroFor(creator, { mode: "none" }), null, "unlocked: cleared");
assert.deepEqual(gameIntroFor(locked, player), locked, "locked: the creator's always");
assert.deepEqual(gameIntroFor(locked, { mode: "none" }), locked);
assert.deepEqual(gameIntroFor(null, player), player, "any game's setup may set one");
assert.deepEqual(gameIntroFor(null, { ...player, locked: true }), player, "a setup's own is never locked");
assert.equal(gameIntroFor(undefined, undefined), null);
assert.match(gameIntroGuidanceText(player), /opening message[\s\S]*Open in the market at dawn\./);
assert.equal(gameIntroGuidanceText(creator), "", "a defined intro asks the Game Master nothing");

// ── In a story script ──
const story = storyScriptSchema.parse({ storyVersion: 1, intro: locked });
assert.deepEqual(story.intro, locked);

// ── Through the generate route ──
const dir = mkdtempSync(join(tmpdir(), "marinara-game-intro-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const db = await getDB();
const chats = createChatsStorage(db);
const original = ClaudeSubscriptionProvider.prototype.chat;
const prompts: string[] = [];
ClaudeSubscriptionProvider.prototype.chat = async function* (
  messages: ChatMessage[],
  _options: ChatOptions,
): AsyncGenerator<string, LLMUsage> {
  prompts.push(messages.map((message) => message.content).join("\n"));
  yield "The Game Master speaks.";
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
};
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
const DEFINED = "The bells of Thrushwick have stopped.\n\nNobody in the square looks up.";
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Intro",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic",
    maxContext: 32768,
  });
  const game = async (gameIntro?: unknown, gameExperienceIntro?: unknown) => {
    const chat = await chats.create({
      name: "intro",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableTools: false,
      gameSessionStatus: "active",
      ...(gameIntro ? { gameIntro } : {}),
      ...(gameExperienceIntro ? { gameExperienceIntro } : {}),
    });
    return chat.id;
  };
  const generate = async (chatId: string, payload: Record<string, unknown> = {}) => {
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId, ...payload } });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return (await chats.listMessages(chatId)).filter((message) => message.role === "assistant").at(-1)!;
  };
  const opening = { generationGuide: "Begin the game now.", generationGuideSource: "game_start" };

  // Defined: exactly the text, and no model asked.
  const defined = await game({ mode: "defined", text: DEFINED });
  const first = await generate(defined, opening);
  assert.equal(prompts.length, 0, "no model writes a defined intro");
  assert.equal(first.content.trim(), DEFINED);
  // Regenerated, it is the same message again.
  const again = await generate(defined, { ...opening, regenerateMessageId: first.id });
  assert.equal(prompts.length, 0);
  assert.equal(again.content.trim(), DEFINED);
  // After it, the Game Master writes as ever.
  await chats.createMessage({ chatId: defined, role: "user", content: "I look up at the tower." });
  const second = await generate(defined);
  assert.equal(prompts.length, 1);
  assert.equal(second.content.trim(), "The Game Master speaks.");
  assert.doesNotMatch(prompts[0]!, /opening message/);

  // Guided: the Game Master writes it, told the guidance, on the opening reply only.
  const guided = await game({ mode: "guided", text: "Open in the flooded market at dawn." });
  await generate(guided, opening);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1]!, /opening message[\s\S]*Open in the flooded market at dawn\./);
  await chats.createMessage({ chatId: guided, role: "user", content: "I wade on." });
  await generate(guided);
  assert.doesNotMatch(prompts[2]!, /flooded market at dawn/);

  // None chosen: the Game Master opens as it would.
  const none = await game({ mode: "none" });
  await generate(none, opening);
  assert.equal(prompts.length, 4);
  assert.doesNotMatch(prompts[3]!, /opening message/);

  // An Experience package's own intro (1.372), kept with the game: locked, it wins over the setup's.
  const packaged = await game(
    { mode: "guided", text: "Open somewhere else." },
    { mode: "defined", text: DEFINED, locked: true },
  );
  assert.equal((await generate(packaged, opening)).content.trim(), DEFINED);
  assert.equal(prompts.length, 4, "a locked defined intro asks no model");
  // Unlocked, it stands only while the setup chose nothing.
  const unlocked = await game(undefined, { mode: "guided", text: "Open at the Year-Wheel." });
  await generate(unlocked, opening);
  assert.match(prompts[4]!, /opening message[\s\S]*Open at the Year-Wheel\./);
  const overridden = await game({ mode: "none" }, { mode: "guided", text: "Open at the Year-Wheel." });
  await generate(overridden, opening);
  assert.doesNotMatch(prompts[5]!, /Year-Wheel/);
} finally {
  ClaudeSubscriptionProvider.prototype.chat = original;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("GM intro message: defined is the first message exactly, guided shapes it, and a locked one stays.");
