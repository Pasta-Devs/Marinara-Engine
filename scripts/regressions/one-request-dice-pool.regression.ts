// ──────────────────────────────────────────────
// One-request dice: the sighted pool.
//
// The pool is the opt-in exception and it ships off, because it is the only mechanism in
// this feature that puts a number in front of the model before the model decides what
// happens. What it buys is an outcome that needs three or more different endings narrated
// in the same pass; what it costs is stated in section 11 of the design and in the
// sub-option's own help text. This lane pins the part that is not a matter of trust.
//
// Six claims, one section each.
//
//   1. THE QUEUE IS THE MECHANISM. Consumption is from the head in reading order, refill
//      shifts the spent slots off and pushes fresh values at the tail, an untouched size
//      keeps its positions exactly, and a slot once shifted off never comes back. Aging
//      is what bounds the frozen head, and with aging off the head really is a latch.
//   2. THE ENGINE COMPUTES THE RECORD, IT DOES NOT CHECK IT. Every number in a pool tag
//      is re-derived from the queue and the sheet. What the model wrote in pool= and
//      rolls= is a checksum: a skipped slot, a reordered one, a reused one and an
//      invented value are each recorded as a mismatch and NONE of them changes a number.
//   3. FRESH IS NOT HISTORICAL, AND THE DIFFERENCE IS OUT OF BAND. The same record with a
//      pool session is re-derived; the same record with no session passes through
//      untouched, byte for byte. That is what keeps every other reader — the client's
//      parser, the segment editor, any re-read of an already-saved transcript — behaving
//      exactly as it does today, and it is why the freshness flag is a parameter rather
//      than a marker in the text.
//   4. OVERFLOW WRITES NOTHING. Past the allotment, or on a size the pool never held,
//      no value exists: the check goes back sparse, the [dice:] tag goes back to its bare
//      request, nothing is invented and no second provider request is made.
//   5. THE DC IS BOUNDED. Choosing the DC after seeing the die is the model's sharpest
//      freedom under the pool, and this path has never bounded a written tag's DC at all.
//   6. REWIND IS CORRECT. A continuation resumes after the slots its own saved segment
//      spent and never respends them; a regenerate re-reads the queue the first telling
//      was dealt, so being asked again cannot improve the luck; a new turn refills.
//
// Plus the registration pins the repo requires of any new file-backed table, and the
// storage-format confirmation open question 9 asks for.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";
import type { GameDicePool, GameDicePoolSize } from "../../packages/shared/src/types/game.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-dice-pool-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const {
  consumeFromPool,
  createGameDicePool,
  DEFAULT_GAME_DICE_POOL_AGE_TURNS,
  DEFAULT_GAME_DICE_POOL_WINDOW,
  formatPoolSlotName,
  GAME_DICE_POOL_ALLOTMENT,
  GAME_DICE_POOL_SIZES,
  parseGameDicePool,
  parsePoolSlotName,
  parseSkillCheckTagBody,
  refillPool,
  renderGameDicePoolView,
  serializeGameDicePool,
  serializeResolvedSkillCheckTag,
} = await import("../../packages/shared/dist/index.js");
const {
  createGameDicePoolSession,
  loadGameDicePoolSession,
  readGameDicePoolSettings,
  renderGameDicePoolPromptBlock,
  serializeGameDicePoolTurn,
} = await import("../../packages/server/src/services/game/dice-pool.service.js");
const { resolveSkillCheckTagsInContent } =
  await import("../../packages/server/src/services/game/skill-check-resolution.service.js");
const { resolveGameDiceRequests } = await import("../../packages/server/src/services/game/dice.service.js");
const { FILE_BACKED_TABLES, STORAGE_VERSION } = await import("../../packages/server/src/db/file-backed-store.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameDicePoolsStorage } =
  await import("../../packages/server/src/services/storage/game-dice-pools.storage.js");
const { gameDicePools } = await import("../../packages/server/src/db/schema/index.js");
const { inArray } = await import("../../packages/server/src/db/file-query.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

/** A scripted die, so every value below is a value this lane chose. */
function scriptedRoller(values: number[]): (sides: number) => number {
  let index = 0;
  return (sides) => {
    const value = values[index % values.length]!;
    index += 1;
    return Math.min(sides, Math.max(1, value));
  };
}

/** A pool built by hand, so a slot's value is readable straight off the case. */
function poolOf(overrides: Partial<Record<GameDicePoolSize, number[]>>): GameDicePool {
  const pool = createGameDicePool(() => 1);
  for (const [size, values] of Object.entries(overrides) as Array<[GameDicePoolSize, number[]]>) {
    pool.values[size] = [...values];
  }
  return pool;
}

const settings = { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS };
/** No snapshot and no player card is the default configuration, so the modifier is zero. */
const emptySheet: SkillCheckModifierContext = { skills: null, attributes: null, sheetAttributes: {} };

// ── 1. The queue ────────────────────────────────────────────────────────────
assert.equal(DEFAULT_GAME_DICE_POOL_WINDOW, 1, "the window ships at 1: the largest single mitigation the pool has");
assert.equal(DEFAULT_GAME_DICE_POOL_AGE_TURNS, 3, "aging ships on, which is what bounds the frozen head");
assert.deepEqual([...GAME_DICE_POOL_SIZES].sort(), ["d10", "d100", "d12", "d20", "d4", "d6", "d8"]);
assert.equal(
  GAME_DICE_POOL_SIZES.reduce((sum, size) => sum + GAME_DICE_POOL_ALLOTMENT[size], 0),
  38,
  "six values for d4 through d20 and two for d100",
);

const queue = poolOf({ d20: [14, 3, 19, 8, 11, 2] });
assert.deepEqual(consumeFromPool(queue, "d20", 0), { value: 14, slot: 0 });
assert.deepEqual(consumeFromPool(queue, "d20", 1), { value: 3, slot: 1 }, "the second spend is the second slot");
assert.equal(consumeFromPool(queue, "d20", 6), null, "past the allotment there is no value at all");

const refilled = refillPool(queue, { d20: 2 }, scriptedRoller([7, 9]), 0);
assert.deepEqual(refilled.pool.values.d20, [19, 8, 11, 2, 7, 9], "spent slots shift off the head, fresh at the tail");
assert.deepEqual(refilled.pool.values.d6, queue.values.d6, "an untouched size keeps its positions exactly");
assert.equal(refilled.pool.idle.d20, 0, "spending resets the aging clock");
assert.equal(refilled.pool.idle.d6, 1, "a size that went untouched ages one turn");

// A slot once shifted off never comes back. Asserted as an exact stream rather than as a
// value comparison, because real dice repeat and the claim is about the QUEUE.
let walked = poolOf({ d20: [1, 2, 3, 4, 5, 6] });
const stream: number[] = [];
let nextValue = 7;
const walkRoller = () => {
  const value = ((nextValue - 1) % 20) + 1;
  stream.push(value);
  nextValue += 1;
  return value;
};
for (let turn = 0; turn < 10_000; turn += 1) {
  walked = refillPool(walked, { d20: 1 }, walkRoller, 0).pool;
  assert.equal(walked.values.d20.length, 6, "the allotment is restored at every refill");
}
assert.deepEqual(
  walked.values.d20,
  stream.slice(-6),
  "after 10,000 single spends the queue is exactly the last six values thrown, and nothing older",
);

// Aging, and the latch it bounds.
let aging = poolOf({ d20: [2, 2, 2, 2, 2, 2] });
for (let turn = 0; turn < 2; turn += 1) {
  aging = refillPool(aging, {}, scriptedRoller([20]), 3).pool;
  assert.equal(aging.values.d20[0], 2, "the head is frozen until the clock runs out");
}
const aged = refillPool(aging, {}, scriptedRoller([20]), 3);
assert.equal(aged.pool.values.d20[0], 20, "the third idle turn rethrows the size");
assert.ok(aged.aged.includes("d20"), "the rethrow is reported so the log can say which size aged out");
assert.equal(aged.pool.idle.d20, 0);

let latched = poolOf({ d20: [2, 2, 2, 2, 2, 2] });
for (let turn = 0; turn < 50; turn += 1) latched = refillPool(latched, {}, scriptedRoller([20]), 0).pool;
assert.equal(latched.values.d20[0], 2, "with aging off the head is a latch, which is exactly why it defaults on");

// Serialization, and a revision this cannot read.
const roundTripped = parseGameDicePool(serializeGameDicePool(queue));
assert.deepEqual(roundTripped, queue, "a pool read back out of its row is the pool that was written");
assert.equal(parseGameDicePool('{"v":2,"values":{}}'), null, "another revision is refused, never half-read");
assert.equal(parseGameDicePool('{"v":1,"values":{"d20":[99]}}'), null, "a value the die cannot show is refused");
{
  const oversized = createGameDicePool(() => 1);
  oversized.values.d20.push(1);
  assert.equal(parseGameDicePool(serializeGameDicePool(oversized)), null, "a queue past its allotment is refused");
  const short = createGameDicePool(() => 1);
  short.values.d20 = [1];
  assert.equal(parseGameDicePool(serializeGameDicePool(short))?.values.d20.length, 1, "a short queue is legitimate");
}
assert.equal(parseGameDicePool("not json"), null);
assert.equal(parseGameDicePool(null), null);

// The window is what the model sees, and it is not the allotment.
const view = renderGameDicePoolView(queue, 1);
assert.equal(view.length, 7, "one entry per size");
assert.deepEqual(view.find((entry) => entry.size === "d20")!.values, [14], "at window 1 the model sees seven values");
assert.deepEqual(renderGameDicePoolView(queue, 3).find((entry) => entry.size === "d20")!.values, [14, 3, 19]);

// Slot names are read as a checksum, so a hostile one costs a log line and nothing else.
assert.equal(formatPoolSlotName("d20", [0]), "d20:1", "slot names are one-based in the tag and zero-based inside");
assert.equal(formatPoolSlotName("d6", [0, 1, 2]), "d6:1|2|3");
assert.deepEqual(parsePoolSlotName('"d6:1|2|3"'), { size: "d6", slots: [0, 1, 2] });
for (const hostile of ["", "d20", "d7:1", "d20:0", "d20:99", "d20:abc", "../../escaped:1", null]) {
  assert.equal(parsePoolSlotName(hostile), null, `${String(hostile)} is not a readable slot name`);
}

// ── 2. The engine computes the record ───────────────────────────────────────
async function resolveWithPool(content: string, pool: GameDicePool) {
  const session = createGameDicePoolSession({ chatId: "chat-pool", pool, settings });
  const resolution = await resolveSkillCheckTagsInContent(content, {
    loadContext: async () => emptySheet,
    chatId: "chat-pool",
    pool: session,
  });
  return { session, resolution };
}

const cleanTag = '[skill_check: skill="Stealth" dc="15" mode="normal" dice="1d20" rolls="14" pool="d20:1"]';
{
  const { session, resolution } = await resolveWithPool(cleanTag, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.equal(resolution.resolved, 1);
  assert.match(resolution.content, /rolls="14"/, "the spent value is the one the queue held");
  assert.match(resolution.content, /total="14"/, "the total is recomputed, never taken from the tag");
  assert.match(resolution.content, /result="failure"/, "the outcome is recomputed against the DC");
  assert.match(resolution.content, /pool="d20:1"/, "the record names the slot the ENGINE spent");
  assert.deepEqual(session.mismatches, [], "a tag that agrees with the queue flags nothing");
  assert.deepEqual(session.consumed, [{ size: "d20", slot: 0, value: 14, tagIndex: 0 }]);
  assert.equal(session.overflow, 0);
}

// Every mismatch kind, and none of them changes a number.
for (const [kind, tag] of [
  // Skipped: the model named the third slot while the first was next.
  ["slot", '[skill_check: skill="Stealth" dc="15" rolls="19" pool="d20:3"]'],
  // Invented: the slot is right and the number is not.
  ["value", '[skill_check: skill="Stealth" dc="15" rolls="20" pool="d20:1"]'],
  // Reordered: the model named a slot out of the order the queue serves them in. That is
  // the same disagreement as skipping one, and it is recorded as the same kind.
  ["slot", '[skill_check: skill="Stealth" dc="15" rolls="3" pool="d20:2"]'],
] as Array<[string, string]>) {
  const { session, resolution } = await resolveWithPool(tag, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.ok(
    session.mismatches.some((mismatch) => mismatch.kind === kind),
    `${kind} was not recorded for ${tag}: ${JSON.stringify(session.mismatches)}`,
  );
  assert.match(resolution.content, /rolls="14"/, `${kind} changed the value the engine spent`);
  assert.match(resolution.content, /pool="d20:1"/, `${kind} changed the slot the engine spent`);
}

// A slot name the engine cannot read is still a claimed pool spend, and this is the
// sharpest case in the section: gated on the name PARSING rather than on it being
// written, such a tag falls back to the ordinary path, where a lone integer in `rolls=`
// is adopted as a player-submitted die — the model's own invented number becoming the
// roll, through the one door the authority rule cannot see.
for (const unreadable of ['pool="d20:7"', 'pool="d7:1"', 'pool="nonsense"', 'pool=""']) {
  const tag = `[skill_check: skill="Stealth" dc="15" rolls="20" ${unreadable}]`;
  const { session, resolution } = await resolveWithPool(tag, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.match(resolution.content, /rolls="14"/, `${unreadable} let the model's own die through`);
  assert.match(resolution.content, /pool="d20:1"/, unreadable);
  assert.equal(session.consumed.length, 1, `${unreadable} did not spend from the queue`);
  assert.ok(
    session.mismatches.some((mismatch) => mismatch.kind === "slot"),
    `${unreadable} was not recorded as a mismatch`,
  );
}

// Reuse: two tags naming the same slot. The engine spends the next value for the second.
{
  const twice = `${cleanTag} and again [skill_check: skill="Stealth" dc="15" rolls="14" pool="d20:1"]`;
  const { session, resolution } = await resolveWithPool(twice, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.ok(
    session.mismatches.some((mismatch) => mismatch.kind === "reuse"),
    `reuse was not recorded: ${JSON.stringify(session.mismatches)}`,
  );
  assert.deepEqual(
    session.consumed.map((entry) => entry.value),
    [14, 3],
    "a value is never served twice, whatever the tag claims",
  );
  assert.match(resolution.content, /pool="d20:2"/, "the second tag records the slot it actually got");
}

// Advantage spends two values and the resolver keeps the higher, through the shipped sum.
{
  const advantage = '[skill_check: skill="Stealth" dc="10" mode="advantage" rolls="14" pool="d20:1"]';
  const { session, resolution } = await resolveWithPool(advantage, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.deepEqual(
    session.consumed.map((entry) => entry.value),
    [14, 3],
    "two dice under advantage is the same count the shipped roller throws",
  );
  assert.match(resolution.content, /rolls="14\|3"/);
  assert.match(resolution.content, /used="14"/, "advantage keeps the higher die");
  assert.match(resolution.content, /pool="d20:1\|2"/);
}

// ── 3. Fresh is not historical ──────────────────────────────────────────────
{
  const record =
    '[skill_check: skill="Stealth" dc="15" rolls="7" used="7" modifier="0" total="7" result="failure" mode="normal" resolution="sum" dice="1d20" pool="d20:1"]';
  const historical = await resolveSkillCheckTagsInContent(record, {
    loadContext: async () => emptySheet,
    chatId: "chat-pool",
  });
  assert.equal(historical.content, record, "with no pool session the record is passed through byte for byte");
  assert.equal(historical.resolved, 0, "a re-read rolls nothing");
  assert.equal(historical.trusted, 1);

  const { resolution } = await resolveWithPool(record, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.match(resolution.content, /rolls="14"/, "with a pool session the same bytes are re-derived");
  assert.equal(resolution.resolved, 1);

  // The same distinction on the general dice reader, which is the one the idempotence
  // assertion in game-text-dice.regression.ts pins.
  const diceRecord = '[dice: 3d6 = 11 (6 + 1 + 4) pool="d6:1|2|3"]';
  const passedThrough = resolveGameDiceRequests(diceRecord);
  assert.equal(passedThrough.content, diceRecord, "a pool-bearing record is not a new request on a re-read");
  assert.equal(passedThrough.rolled, 0);
  assert.deepEqual(passedThrough.unresolved, [], "nor is it a diagnostic failure");
}

// ── 4. Overflow writes nothing ──────────────────────────────────────────────
{
  const seven = Array.from({ length: 7 }, () => cleanTag).join(" ");
  const { session, resolution } = await resolveWithPool(seven, poolOf({ d20: [14, 3, 19, 8, 11, 2] }));
  assert.equal(session.overflow, 1, "the seventh d20 tag had no value to spend");
  assert.equal(resolution.content.match(/pool="d20:/g)?.length, 6, "six tags spent, one did not");
  const overflowed = [...resolution.content.matchAll(/\[skill_check:[^\]]+\]/g)].at(-1)![0];
  assert.doesNotMatch(overflowed, /total=|result=|used=|modifier=/, `an overflow invented numbers: ${overflowed}`);
  assert.match(overflowed, /skill="Stealth"/, "the ask survives an overflow");
  assert.match(overflowed, /dc="15"/);
  // Still owed a roll, so the outcome is narrated next turn rather than invented now.
  const reread = parseSkillCheckTagBody(overflowed.slice("[skill_check:".length, -1));
  assert.equal(reread?.resolvedResult, undefined);
}

{
  // A size the pool never held. The grammar allows a hundred dice of a thousand sides and
  // pre-loading that space is not possible, so d13 is an overflow, not a pool miss.
  const session = createGameDicePoolSession({ chatId: "chat-pool", pool: poolOf({}), settings });
  const unpooled = resolveGameDiceRequests('[dice: 2d13 = 14 (7 + 7) pool="d6:1|2"]', [], undefined, session);
  assert.equal(session.overflow, 1);
  assert.equal(unpooled.content, "[dice: 2d13]", "the tag goes back to the bare request it started as");
  assert.equal(unpooled.diceRolls.length, 0, "nothing was rolled, so nothing joins the dice history");
}

{
  // The [dice:] arm, spending three d6 in order.
  const session = createGameDicePoolSession({
    chatId: "chat-pool",
    pool: poolOf({ d6: [6, 1, 4, 4, 2, 5] }),
    settings,
  });
  const spent = resolveGameDiceRequests('[dice: 3d6 = 99 (9 + 9 + 9) pool="d6:1|2|3"]', [], undefined, session);
  assert.equal(spent.content, '[dice: 3d6 = 11 (6 + 1 + 4) pool="d6:1|2|3"]', "the engine writes its own arithmetic");
  assert.deepEqual(spent.diceRolls[0]!.rolls, [6, 1, 4]);
  assert.ok(
    session.mismatches.some((mismatch) => mismatch.kind === "value"),
    "the invented per-die numbers are recorded",
  );
}

// ── 5. The DC is bounded ────────────────────────────────────────────────────
{
  const { resolution } = await resolveWithPool(
    '[skill_check: skill="Stealth" dc="500" rolls="14" pool="d20:1"]',
    poolOf({ d20: [14, 3, 19, 8, 11, 2] }),
  );
  assert.match(resolution.content, /dc="40"/, "the DC is clamped to the bound the endpoint's own schema enforces");
  const low = await resolveWithPool(
    '[skill_check: skill="Stealth" dc="-5" rolls="14" pool="d20:1"]',
    poolOf({ d20: [14, 3, 19, 8, 11, 2] }),
  );
  assert.match(low.resolution.content, /dc="1"/);
}

// ── 5b. A pool claim the resolver cannot roll loses its numbers ─────────────
{
  // An engine-rollable pool check the resolver refuses (a skill past the length bound) is
  // written back without the numbers it claimed, never left as the model wrote it.
  const longSkill = "S".repeat(101);
  const { resolution } = await resolveWithPool(
    `[skill_check: skill="${longSkill}" dc="15" rolls="14" used="14" modifier="0" total="14" result="failure" pool="d20:1"]`,
    poolOf({ d20: [14, 3, 19, 8, 11, 2] }),
  );
  assert.equal(resolution.sparse, 1, "counted as sparse, because it is");
  assert.match(resolution.content, new RegExp(`skill="${longSkill}" dc="15"`), "the ask survives as written");
  assert.doesNotMatch(resolution.content, /rolls=|used=|modifier=|total=|result=|pool=/, "the claim does not");
}
{
  // `pool=` written in front of nothing the grammar can read: the numbers on such a record
  // are a claim the pool never validated, so they are dropped with the claim.
  const session = createGameDicePoolSession({ chatId: "chat-pool", pool: poolOf({}), settings });
  const garbage = resolveGameDiceRequests('[dice: nope = 17 (9 + 8) pool="d6:1"]', [], undefined, session);
  assert.equal(garbage.content, "[dice: nope]", "the head stays as the bare ask it may have been");
  assert.equal(garbage.diceRolls.length, 0);
  // With no pool in play the same text is left exactly as written, as it always was.
  const historical = resolveGameDiceRequests('[dice: nope = 17 (9 + 8) pool="d6:1"]', []);
  assert.equal(historical.content, '[dice: nope = 17 (9 + 8) pool="d6:1"]');
  // An empty slot name is still a claim, and the tag is still recomputed from the pool.
  const empty = createGameDicePoolSession({ chatId: "chat-pool", pool: poolOf({ d6: [2, 5, 3, 3, 1, 6] }), settings });
  const emptyClaim = resolveGameDiceRequests('[dice: 2d6 = 12 (6 + 6) pool=""]', [], undefined, empty);
  assert.equal(emptyClaim.content, '[dice: 2d6 = 7 (2 + 5) pool="d6:1|2"]', "the engine's arithmetic, not the model's");
  assert.ok(empty.mismatches.some((mismatch) => mismatch.kind === "slot"));
}
{
  // A success pool that overflows keeps its per-die threshold: without it every later
  // reader would refuse the ask for having no counting rule.
  const session = createGameDicePoolSession({
    chatId: "chat-pool",
    pool: poolOf({ d10: [6, 7, 2, 9, 1, 8] }),
    settings,
  });
  const overflowed = resolveGameDiceRequests(
    '[skill_check: skill="Intimidation" dc="4" dice="7d10" resolution="successes" threshold="6" rolls="6|7|2|9|1|8|9" total="5" result="success" pool="d10:1|2|3|4|5|6|7"]',
    [],
    undefined,
    session,
  );
  assert.equal(session.overflow, 1);
  assert.match(overflowed.content, /threshold="6"/, "the counting rule survives the overflow");
  assert.match(overflowed.content, /resolution="successes"/);
  assert.doesNotMatch(overflowed.content, /rolls=|total=|result=|pool=/, "the claimed numbers do not");
}

// ── 6. Rewind, continuation, and the row ────────────────────────────────────
const db = await getDB();
const chats = createChatsStorage(db);
const pools = createGameDicePoolsStorage(db);
const calls: ChatMessage[][] = [];
const draft =
  'You slip along the wall. [skill_check: skill="Stealth" dc="15" mode="normal" dice="1d20" rolls="14" pool="d20:1"] The guard turns at the worst moment.';
async function* scriptedChat(messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  calls.push(structuredClone(messages));
  yield draft;
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
}
const originalClaude = ClaudeSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = scriptedChat;
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Pool fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  const chat = await chats.create({
    name: "Dice pool",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  // The configuration the repo's own dice lane runs in: no agents and no tools, so there
  // is no game-state snapshot at all. The row still has to be written, which is the whole
  // reason the pool has a table rather than a snapshot column.
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    gameOneRequestDice: true,
    gameDicePoolMode: true,
  });

  await chats.createMessage({ chatId: chat.id, role: "user", content: "Sneak past the guard." });
  calls.length = 0;
  const turn = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(turn.statusCode, 200, turn.body);
  assert.ok(!turn.body.includes('"type":"error"'), turn.body);
  assert.equal(calls.length, 1, "a pool turn is still one provider request");

  const prompt = JSON.stringify(calls[0]);
  assert.ok(prompt.includes("<dice_pool>"), "the model was shown the head values it is asked to spend");
  assert.ok(prompt.includes("<check_modifiers>"), "without the modifiers it knows the die and not the total");
  assert.ok(prompt.includes("spend a pool value"), "the fourth bullet asks for a spend rather than for a bare tag");

  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  assert.match(saved.content, /pool="d20:1"/, `the saved record names the slot: ${saved.content}`);
  const savedRecord = /\[skill_check:[^\]]+\]/.exec(saved.content)![0];
  assert.match(savedRecord, /total="\d+"/, "the engine's own numbers are what got saved");

  const row = await pools.getForTurn(chat.id, saved.id, 0);
  assert.ok(row, "a turn with agents off still writes a pool row");
  const storedPool = parseGameDicePool(row!.pool)!;
  assert.ok(storedPool, "the row round-trips through the parser");
  const storedConsumed = JSON.parse(row!.consumed) as Array<{ size: string; slot: number; value: number }>;
  assert.equal(storedConsumed.length, 1, "the ledger records exactly what the turn spent");
  assert.equal(storedConsumed[0]!.size, "d20");
  assert.equal(storedConsumed[0]!.slot, 0);
  assert.match(savedRecord, new RegExp(`rolls="${storedConsumed[0]!.value}"`), "the record and the ledger agree");
  // The spent value is still at the head of the STORED queue: a refill would have shifted
  // it off, so its presence there is what proves the refill is deferred to the next turn.
  assert.equal(
    storedPool.values.d20[0],
    storedConsumed[0]!.value,
    "the row stores the queue the turn was PROMPTED with, refill deferred to the next turn",
  );

  const extra = JSON.parse(saved.extra) as { gameDiceTurn?: { poolSlots?: unknown[]; poolOverflow?: number } };
  assert.equal(extra.gameDiceTurn?.poolSlots?.length, 1, "the turn notice reports the slots spent");
  assert.equal(extra.gameDiceTurn?.poolOverflow, undefined, "a clean turn records no overflow");

  // The row is keyed by the triple, so a second save for the same (message, swipe) is an
  // update in place: same id, the timestamp of the save that created the row, and no second
  // row for `getForTurn` to pick between. Only the queue and the ledger change.
  {
    const rewritten = await pools.save({
      chatId: chat.id,
      messageId: saved.id,
      swipeIndex: 0,
      pool: row!.pool,
      consumed: "[]",
    });
    assert.equal(rewritten.id, row!.id, "the id is the triple, so it does not change");
    assert.equal(rewritten.createdAt, row!.createdAt, "the original timestamp is kept");
    assert.equal(rewritten.consumed, "[]", "the ledger is what changed");
    const rows = (await db.select().from(gameDicePools)) as Array<{ id: string; messageId: string }>;
    assert.equal(rows.filter((candidate) => candidate.messageId === saved.id).length, 1, "and there is still one row");
    await pools.save({ chatId: chat.id, messageId: saved.id, swipeIndex: 0, pool: row!.pool, consumed: row!.consumed });
  }

  // Distinct turns never tie on the stamp. The clock has millisecond precision and the
  // reads order by the stamp alone, so two rows written in the same millisecond would
  // leave "latest" to whichever the store kept first; the stamp is strictly increasing
  // within the process instead, and the newest row is always the last one saved.
  {
    const stamps = new Set<string>();
    for (let index = 0; index < 5; index += 1) {
      const written = await pools.save({
        chatId: chat.id,
        messageId: `tie-${index}`,
        swipeIndex: 0,
        pool: row!.pool,
        consumed: "[]",
      });
      stamps.add(written.createdAt);
    }
    assert.equal(stamps.size, 5, "five saves in a tight loop carry five distinct stamps");
    assert.equal([...stamps].sort().at(-1), (await pools.getLatestForChat(chat.id))?.createdAt);
    assert.equal((await pools.getLatestForChat(chat.id))?.messageId, "tie-4", "the newest row is the last one saved");
    assert.ok(
      (await pools.getLatestForChat(chat.id))!.createdAt > row!.createdAt,
      "and it is newer than the real turn's row",
    );
    await db.delete(gameDicePools).where(
      inArray(
        gameDicePools.messageId,
        [0, 1, 2, 3, 4].map((i) => `tie-${i}`),
      ),
    );
    assert.equal((await pools.getLatestForChat(chat.id))?.id, row!.id, "the real turn's row is the latest again");
  }

  // A regenerate re-reads the queue the first telling was dealt. Asked again, the model
  // faces the same luck, which is what closes reroll-until-lucky.
  const regenerated = await loadGameDicePoolSession(
    db,
    chat.id,
    { kind: "regenerate", messageId: saved.id },
    readGameDicePoolSettings({}),
  );
  assert.deepEqual(regenerated.pool.values.d20, storedPool.values.d20, "a regenerate faces the same queue");
  assert.deepEqual(regenerated.consumed, [], "and an empty ledger, because it is telling the turn again");

  // A continuation re-reads its own row AND its own ledger, and resumes after it.
  const continued = await loadGameDicePoolSession(
    db,
    chat.id,
    { kind: "continue", messageId: saved.id, swipeIndex: 0 },
    readGameDicePoolSettings({}),
  );
  assert.deepEqual(continued.pool.values.d20, storedPool.values.d20, "the same head values the first segment saw");
  assert.equal(continued.carried.length, 1, "the slots the saved segment spent are carried, not respent");
  const resumed = continued.spend("d20", 1, 0)!;
  assert.equal(resumed[0]!.slot, 1, "spending resumes after the last slot the saved segment consumed");
  assert.equal(
    resumed[0]!.value,
    storedPool.values.d20[1],
    "and it gets the queue's next value, not the first one again",
  );
  assert.deepEqual(
    serializeGameDicePoolTurn(continued).consumed,
    JSON.stringify(continued.consumed),
    "the continuation's row carries both segments' spends on one ledger",
  );

  // A new turn refills: the spent slot shifts off the head, everything else keeps its place.
  const next = await loadGameDicePoolSession(db, chat.id, { kind: "fresh" }, readGameDicePoolSettings({}));
  assert.deepEqual(
    next.pool.values.d20.slice(0, 5),
    storedPool.values.d20.slice(1),
    "the consumed slot is gone and the rest of the queue keeps its positions",
  );
  assert.equal(next.pool.values.d20.length, 6, "and the allotment is restored");
  assert.equal(next.pool.idle.d6, 1, "the sizes this turn never touched aged by one");

  // The prompt block renders from the same session the readers spend out of.
  const block = renderGameDicePoolPromptBlock(next, emptySheet);
  assert.match(block, /^<dice_pool>/);
  assert.ok(block.includes(`The next d20 is ${next.pool.values.d20[0]}.`), block);
  assert.ok(block.includes("<check_modifiers>"), block);
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalClaude;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

// ── Registration, and the storage format ────────────────────────────────────
assert.ok(FILE_BACKED_TABLES.includes("game_dice_pools"), "a table the store does not know cannot be written at all");
const storeSource = readFileSync(join(repositoryRoot, "packages/server/src/db/file-backed-store.ts"), "utf8");
for (const pin of [
  'game_dice_pools: "chatId"',
  '{ parent: "chats", child: "game_dice_pools", parentKey: "id", childKey: "chatId" }',
  '{ parent: "messages", child: "game_dice_pools", parentKey: "id", childKey: "messageId" }',
]) {
  assert.ok(storeSource.includes(pin), `game_dice_pools is missing its registration: ${pin}`);
}
const launcherSource = readFileSync(join(repositoryRoot, "scripts/protect-launcher-data.mjs"), "utf8");
assert.ok(
  launcherSource.includes('"game_dice_pools"'),
  "unshard must fold the new table back into a monolith or it vanishes for a downgraded build",
);
// Open question 9, confirmed rather than assumed: a table addition registered in
// FILE_BACKED_TABLES does not move the storage format, and the launcher's downgrade guard
// reads that file through `git show` on the update target, so a wrong call there silently
// disables the protection rather than failing loudly.
const declaredFormat = JSON.parse(readFileSync(join(repositoryRoot, "storage-format.json"), "utf8")).storageFormat;
assert.equal(declaredFormat, STORAGE_VERSION, "storage-format.json must still equal STORAGE_VERSION");

console.log("one-request-dice-pool regression: OK");
