// ──────────────────────────────────────────────
// One-request dice: the gate, the wrapper and the failure contract.
//
// The whole point of the feature is that a Game turn which rolls dice costs one
// provider request instead of two, so the assertion that matters most is a call count.
// This lane drives the real generate route with the subscription transports stubbed,
// exactly as game-text-dice.regression.ts does, and counts the calls on both sides of
// the switch.
//
// It also drives the extracted helper directly, because the pass's failure contract is
// about an arm that throws, and there is no way to make a route-driven arm throw
// without a model. The gate itself is an exported predicate for the same reason.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-one-request-dice-"));
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
const {
  ROLL_UNAVAILABLE_TEXT,
  applyChanceFallback,
  createGameTurnChanceSession,
  isOneRequestDiceEnabled,
  replaceUnreadablePlaceholders,
  resolveGameTurnBranches,
  resolveGameTurnPlaceholders,
  runGameTurnChancePass,
  shouldNarrateGameDiceOutcome,
  stripBranchDelimiters,
  summarizeGameDiceTurn,
} = await import("../../packages/server/src/services/game/one-request-dice.js");
const { rollDieSecurely } = await import("../../packages/server/src/services/game/dice-rng.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

// ── The gate, as a predicate ──
// While the switch is on this reads as if the narration toggle were off, for every
// branch of the failure contract, whatever the stored narration preference says.
assert.equal(shouldNarrateGameDiceOutcome({}, true), true, "today's default still rewrites a rolled turn");
assert.equal(shouldNarrateGameDiceOutcome({}, false), false, "a turn with no rolls never rewrote");
assert.equal(shouldNarrateGameDiceOutcome({ gameDiceOutcomeNarration: false }, true), false);
for (const stored of [undefined, true, false]) {
  const meta = { gameOneRequestDice: true, ...(stored === undefined ? {} : { gameDiceOutcomeNarration: stored }) };
  assert.equal(shouldNarrateGameDiceOutcome(meta, true), false, "the switch holds the rewrite closed when rolls land");
  assert.equal(shouldNarrateGameDiceOutcome(meta, false), false);
  assert.equal(
    (meta as Record<string, unknown>).gameDiceOutcomeNarration,
    stored,
    "the gate reads the stored narration preference and never writes it",
  );
}
assert.equal(isOneRequestDiceEnabled(undefined), false, "absent means off");
assert.equal(isOneRequestDiceEnabled({}), false);
assert.equal(isOneRequestDiceEnabled({ gameOneRequestDice: false }), false);
assert.equal(isOneRequestDiceEnabled({ gameOneRequestDice: "true" }), false, "only a real boolean arms the switch");
assert.equal(isOneRequestDiceEnabled({ gameOneRequestDice: true }), true);

// ── The roller ──
for (let attempt = 0; attempt < 200; attempt += 1) {
  const face = rollDieSecurely(6);
  assert.ok(Number.isInteger(face) && face >= 1 && face <= 6, `d6 face out of range: ${face}`);
}
assert.equal(rollDieSecurely(1), 1);
assert.throws(() => rollDieSecurely(0), RangeError);
assert.throws(() => rollDieSecurely(2.5), RangeError);

// ── The bounded span walk ──
// Every `[[roll:` the model can write produces a bounded span, and every bounded span
// is replaced. Never with a number.
const spanCases: Array<[string, string]> = [
  ["He swings for [[roll: 2d6+3]] damage.", `He swings for ${ROLL_UNAVAILABLE_TEXT} damage.`],
  ["Odd body [[roll: 2d6 [x]]] here.", `Odd body ${ROLL_UNAVAILABLE_TEXT} here.`],
  ["Unclosed [[roll: 2d6] and the rest of the line.", "Unclosed (roll unavailable)"],
  ["Two [[roll: 1d4]] then [[roll: 1d6]].", `Two ${ROLL_UNAVAILABLE_TEXT} then ${ROLL_UNAVAILABLE_TEXT}.`],
  ["Cased [[ROLL: 1d4]] too.", `Cased ${ROLL_UNAVAILABLE_TEXT} too.`],
];
for (const [raw, expected] of spanCases) {
  const swept = replaceUnreadablePlaceholders(raw, "lane");
  assert.equal(swept.changed, true, raw);
  assert.ok(swept.content.startsWith(expected), `${raw} -> ${swept.content}`);
  assert.doesNotMatch(swept.content, /\[\[roll:/i, `a raw opener survived: ${swept.content}`);
  assert.doesNotMatch(swept.content, /\d+d\d+/i, `a notation survived: ${swept.content}`);
}
const overLong = `Body [[roll: ${"9".repeat(200)}]] end.`;
const sweptLong = replaceUnreadablePlaceholders(overLong, "lane");
assert.doesNotMatch(sweptLong.content, /\[\[roll:/i, "an over-long body is found, refused and replaced");
assert.doesNotMatch(sweptLong.content, /9999/, "an over-long body leaves no digits behind");
const unterminated = replaceUnreadablePlaceholders("A [[roll: 2d6\nNext line survives.", "lane");
assert.ok(
  unterminated.content.endsWith("\nNext line survives."),
  `an unterminated opener stops at the line break: ${unterminated.content}`,
);
assert.equal(replaceUnreadablePlaceholders("Nothing to do here.", "lane").changed, false);
assert.equal(
  replaceUnreadablePlaceholders('A [dice: 2d6] and a [roll: character="Mari"].', "lane").changed,
  false,
  "the sweep claims only the doubled opener; no shipped tag spelling is touched",
);

// ── The branch delimiters ──
// None of these four is reachable by a removable-tag set: `[on success]` and
// `[/branch]` are not `[name:` or `[name]` heads at all.
const stripped = stripBranchDelimiters("[branch: crates]\n[on success]Up.\n[on failure]Down.\n[/branch]");
assert.equal(stripped.changed, true);
assert.doesNotMatch(stripped.content, /\[branch:|\[on\s|\[\/branch\]/i, stripped.content);
assert.match(stripped.content, /Up\./);
assert.equal(stripBranchDelimiters("No delimiters here.").changed, false);

// ── The throw-safe wrapper ──
const session = createGameTurnChanceSession({
  db: null as never,
  chatId: "lane",
  loadModifierContext: () => {
    throw new Error("the lane never reads a sheet");
  },
});
const thrown = await runGameTurnChancePass(
  "Draft [[roll: 2d6]] with [branch: x]\n[on success]A[on failure]B\n[/branch]",
  session,
  () => {
    throw new Error("synthetic arm failure");
  },
  "placeholder",
);
assert.equal(session.failed, true, "a thrown arm marks the session rather than escaping the route");
assert.equal(thrown.changed, true, "the caller is told to set contentReplaced, or the fix is saved but never sent");
assert.doesNotMatch(thrown.content, /\[\[roll:/i, thrown.content);
assert.doesNotMatch(thrown.content, /\[branch:|\[on\s|\[\/branch\]/i, thrown.content);
assert.ok(thrown.content.includes(ROLL_UNAVAILABLE_TEXT));
const afterFailure = await runGameTurnChancePass(
  "Late [[roll: 1d4]] span.",
  session,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.doesNotMatch(afterFailure.content, /\[\[roll:/i, "a span arriving after the failure is still swept");
const notice = summarizeGameDiceTurn(session);
assert.equal(notice?.passFailed, true);
assert.ok((notice?.unreadablePlaceholders ?? 0) >= 1);

const cleanSession = createGameTurnChanceSession({ db: null as never, chatId: "lane" });
const cleanBranch = await runGameTurnChancePass("Plain prose.", cleanSession, resolveGameTurnBranches, "branch");
const cleanPlaceholder = await runGameTurnChancePass(
  cleanBranch.content,
  cleanSession,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.equal(cleanPlaceholder.changed, false, "a turn with no chance forms is left byte-identical");
assert.equal(cleanPlaceholder.content, "Plain prose.");
assert.equal(summarizeGameDiceTurn(cleanSession), null, "a clean turn records nothing on the message");
const fallbackOnly = applyChanceFallback("Nothing here.", cleanSession, "branch");
assert.equal(fallbackOnly.changed, false);

// ── The route, on both sides of the switch ──
const calls: ChatMessage[][] = [];
const draft = 'He does not see you. [skill_check: skill="Stealth" dc="40" rolls="2"] You escape unseen. [dice: 3d1+2]';
async function* scriptedChat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  calls.push(structuredClone(messages));
  assert.equal(options.tools, undefined, "subscription transports never receive native tool schemas");
  if (messages.at(-1)?.content.includes("The engine has now rolled the requested dice:")) {
    yield "The guard spots you.";
  } else {
    yield draft;
  }
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
}
const originalClaude = ClaudeSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = scriptedChat;
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "One-request fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  const chat = await chats.create({
    name: "One-request dice",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });

  // Switch off: today's behaviour, byte for byte. A rolled turn still pays for the rewrite.
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Sneak past the guard." });
  calls.length = 0;
  const before = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(before.statusCode, 200, before.body);
  assert.ok(!before.body.includes('"type":"error"'), before.body);
  assert.equal(calls.length, 2, "with the switch off a rolled turn still makes the narration rewrite");
  const rewritten = (await chats.listMessages(chat.id)).at(-1)!;
  assert.match(rewritten.content, /The guard spots you/);
  assert.equal(JSON.parse(rewritten.extra).gameDiceTurn, undefined, "the switch off records no dice-turn notice");
  assert.ok(!before.body.includes("game_dice_turn_notice"), "no notice frame while the switch is off");

  // Switch on: the same turn, the same rolls, one request.
  await chats.patchMetadata(chat.id, { gameOneRequestDice: true });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Sneak past the guard again." });
  calls.length = 0;
  const gated = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(gated.statusCode, 200, gated.body);
  assert.ok(!gated.body.includes('"type":"error"'), gated.body);
  assert.equal(calls.length, 1, "the switch holds the narration rewrite closed even though rolls resolved");
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(saved.role, "assistant");
  assert.match(saved.content, /He does not see you/, "the committed draft stands; nothing is rewritten");
  assert.match(saved.content, /\[dice: 3d1\+2 = 5/, "the engine's record is still written into the turn");
  assert.match(saved.content, /result="failure"/, "the check still resolves for real against the sheet");
  assert.equal(JSON.parse(saved.extra).diceRollResults[0].total, 5);
  assert.equal(
    JSON.parse((await chats.getById(chat.id))!.metadata).gameDiceOutcomeNarration,
    undefined,
    "the switch never writes the player's narration preference",
  );

  // Switch on with the narration preference explicitly on: still one request.
  await chats.patchMetadata(chat.id, { gameDiceOutcomeNarration: true });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "And once more." });
  calls.length = 0;
  const bothOn = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.ok(!bothOn.body.includes('"type":"error"'), bothOn.body);
  assert.equal(calls.length, 1, "an explicitly enabled narration toggle is inert while the switch is on");
  assert.equal(
    JSON.parse((await chats.getById(chat.id))!.metadata).gameDiceOutcomeNarration,
    true,
    "and it is still stored exactly as the player left it",
  );
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalClaude;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("One-request dice: the gate holds the rewrite closed, and the pass never throws out of the turn.");
