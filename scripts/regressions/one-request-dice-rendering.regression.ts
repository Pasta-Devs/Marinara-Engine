// ──────────────────────────────────────────────
// One-request dice: what the player watches, and what the number is marked with.
//
// The chance pass runs AFTER the draft has streamed, which leaves two visible problems
// this lane exists to pin.
//
//   1. WHILE THE DRAFT STREAMS, the raw `[[roll: 2d6+3]]` would appear and then silently
//      become `14`. The stream filter holds every claimed candidate until it closes and
//      emits nothing, so the placeholder is never on screen — not whole, and not as the
//      partial `[[ro` that a six-character token chunk would otherwise deliver. A
//      candidate that turns out to be malformed is released VERBATIM rather than eaten,
//      because the saved content is corrected by the pass and the streamed view is the
//      only place a raw span is ever allowed to be seen.
//   2. AFTER THE TURN IS SAVED, the content carries a bare number, on purpose: the prompt
//      leaf and an older transcript both have to read as prose. The breakdown therefore
//      rides on the message extra and is reattached at render time. Offsets cannot be
//      trusted for that — tags are stripped ahead of the number and the narration is split
//      into segments — so the matcher only marks a number when the text says which
//      occurrence it is, and degrades to the plain number otherwise. Marking the wrong
//      word would attach a real roll to a number nobody rolled.
//
// Plus the negative lane that keeps all of it opt-in: with the switch off, the filter is
// not in the chain at all and the spelling streams exactly as the model wrote it.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-dice-rendering-"));
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
const { createGameChanceStreamFilter } =
  await import("../../packages/server/src/services/game/chance-stream-filter.js");
const { applyGameDiceMarkers, formatGameDiceModifier, formatGameDiceRolls, matchGameDicePlaceholders } =
  await import("../../packages/client/src/lib/game-dice-markers.js");
const { PLACEHOLDER_BODY_MAX } = await import("../../packages/shared/dist/index.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

type PlaceholderRecord = Parameters<typeof formatGameDiceRolls>[0];

/** Drive the filter the way the route does: one small chunk at a time. */
function stream(text: string, chunkSize: number): { visible: string; partials: string[] } {
  const filter = createGameChanceStreamFilter();
  let visible = "";
  const partials: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    const emitted = filter.push(text.slice(index, index + chunkSize));
    if (emitted) partials.push(emitted);
    visible += emitted;
  }
  const tail = filter.flush();
  if (tail) partials.push(tail);
  return { visible: visible + tail, partials };
}

/** Every chunk size a provider might hand us, including one character at a time. */
function everyChunking(text: string): string[] {
  return [1, 2, 3, 6, 7, 64, text.length].map((size) => stream(text, Math.max(1, size)).visible);
}

// ── The stream filter: a placeholder is never on screen ──────────────────────
const damage = "The axe bites deep for [[roll: 2d6+3]] damage, and the wound burns for [[roll: 1d4]] rounds.";
for (const visible of everyChunking(damage)) {
  assert.equal(visible, "The axe bites deep for  damage, and the wound burns for  rounds.");
}
// Not even a partial opener leaks: six characters is the route's own token chunk size, so
// `[[ro` would otherwise be a whole frame of its own.
for (const size of [1, 2, 3, 4, 6]) {
  const { partials } = stream(damage, size);
  for (const chunk of partials) {
    assert.doesNotMatch(chunk, /\[/, `a bracket reached the token stream in a ${size}-character chunking: ${chunk}`);
  }
}

// Prose that only looks like an opener is untouched, and the Roleplay `[roll:` command is
// never claimed here: it is a single bracket and belongs to another mode entirely.
for (const untouched of [
  "Nothing bracketed at all.",
  "A [dice: 2d6] tag streams as it always did.",
  'A [roll: character="Mari" notation="1d20"] command is not this filter\'s business.',
  "A [[ of brackets and a stray ] too.",
  "A [bracketed] word.",
]) {
  for (const visible of everyChunking(untouched)) assert.equal(visible, untouched);
}

// ── A malformed candidate is released verbatim ───────────────────────────────
// The span still becomes a visible notice in the SAVED content; the streamed view is the
// only place it is ever seen, and only until the replace frame lands.
const unterminated = "Unclosed [[roll: 2d6 and then the line ends.\nThe next line is ordinary.";
for (const visible of everyChunking(unterminated)) {
  assert.equal(visible, unterminated, "a newline proves the candidate was never a placeholder");
}
// A body at the cap closes, and is held: the scanner refuses it and the saved content
// carries the notice, so it changes exactly like a readable one does.
const atCap = `Body [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX)}]] end.`;
for (const visible of everyChunking(atCap)) {
  assert.equal(visible, "Body  end.", "a body at the cap is still a bounded span");
}
// Far past the hold, no `]]` closes anything any more, so the candidate is handed back
// rather than swallowing the rest of the line. The result is the same however the
// provider chunked its tokens, which is the point of bounding the hold by an OFFSET.
const overLongClosed = `Body [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 40)}]] end.`;
for (const visible of everyChunking(overLongClosed)) {
  assert.equal(visible, overLongClosed, "past the hold nothing closes the candidate");
}
// An over-long body that never closes is not a candidate at all past the cap, and the
// held text is handed back rather than swallowing the rest of the line.
const overLongOpen = `Body [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 40)} and the sentence goes on.`;
for (const visible of everyChunking(overLongOpen)) {
  assert.equal(visible, overLongOpen, "past the body cap an unterminated candidate is released verbatim");
}
const danglingOpener = "A sentence that just ends on [[roll: 2d6";
for (const visible of everyChunking(danglingOpener)) {
  assert.equal(visible, danglingOpener, "the flush hands back whatever never closed");
}

// A malformed candidate releases ONLY its own bounded prefix. Dumping the whole carry and
// returning would hand back everything that happened to arrive in the same provider chunk
// behind it, so a well-formed placeholder after a malformed one would stream raw and then
// silently become a number when the replace frame lands — and the streamed view would
// depend on how the provider chunked its tokens, which a filter bounded by an OFFSET is
// supposed to make impossible. A non-streaming provider hands the whole turn over at once.
const brokenThenValid = "Broken [[roll: 2d6\nand [[roll: 1d4]] more";
for (const visible of everyChunking(brokenThenValid)) {
  assert.equal(
    visible,
    "Broken [[roll: 2d6\nand  more",
    "the span behind a malformed one is still held, in every chunking",
  );
}
// The release is bounded by the cap even when a line break sits far beyond it. Taking the
// line break outright would hand back everything before it, the valid placeholder
// included, in the one chunking where the whole line arrives at once.
const brokenPastCapThenValid = `Broken [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 40)} and [[roll: 1d4]] more\nnext`;
for (const visible of everyChunking(brokenPastCapThenValid)) {
  assert.equal(
    visible,
    `Broken [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 40)} and  more\nnext`,
    "a line break past the cap does not widen the release to the placeholder before it",
  );
}

// A nested closer run is consumed whole, the same way the scanner bounds its span, so no
// stray `]` is left standing in the streamed sentence either.
for (const visible of everyChunking("Odd [[roll: 2d6 [x]]] here.")) {
  assert.equal(visible, "Odd  here.");
}

// ── The branch block ─────────────────────────────────────────────────────────
// Both halves are held, because watching both outcomes appear before one is deleted is
// exactly the view the blind mechanism exists to prevent.
const branch = "Before. [branch: swing]\n[on success]\nYou hit.\n[on failure]\nYou miss.\n[/branch] After.";
for (const visible of everyChunking(branch)) {
  assert.equal(visible, "Before.  After.");
  assert.doesNotMatch(visible, /on success|on failure|You hit|You miss/);
}
// The hold is cut at the closer's position in the ORIGINAL text, not at an offset taken
// from a lowercased copy: `İ` (U+0130) lowercases to two code units, so such an offset
// would drift and the filter would cut the held block in the wrong place — differently in
// different chunkings.
const turkishBranch = "Before. [branch: x]\n[on success] İstanbul.\n[on failure] İzmir.\n[/branch] TAIL";
for (const visible of everyChunking(turkishBranch)) {
  assert.equal(visible, "Before.  TAIL", "a length-changing lowercase cannot move the closer the hold is cut at");
}
const unclosedBranch = "Before. [branch: swing]\n[on success]\nYou hit.";
for (const visible of everyChunking(unclosedBranch)) {
  assert.equal(visible, unclosedBranch, "a branch that never closes is released verbatim at the flush");
}

// ── The inline marker: what it marks, and what it declines to mark ───────────
function record(overrides: Partial<PlaceholderRecord> & Pick<PlaceholderRecord, "text" | "total">): PlaceholderRecord {
  return {
    raw: "2d6+3",
    notation: "2d6+3",
    rolls: [4, 5],
    modifier: 3,
    modifierSource: "flat",
    index: 0,
    ...overrides,
  } as PlaceholderRecord;
}
const describe = (entry: PlaceholderRecord) =>
  `${entry.raw}: ${formatGameDiceRolls(entry)} = ${entry.total}` +
  (formatGameDiceModifier(entry) ? ` [${formatGameDiceModifier(entry)}]` : "");

assert.equal(formatGameDiceRolls(record({ text: "12", total: 12 })), "4 + 5 + 3");
assert.equal(formatGameDiceRolls(record({ text: "6", total: 6, modifier: -3 })), "4 + 5 − 3");
assert.equal(formatGameDiceRolls(record({ text: "9", total: 9, modifier: 0 })), "4 + 5");
assert.equal(formatGameDiceModifier(record({ text: "9", total: 9, modifier: 0 })), "");
assert.equal(formatGameDiceModifier(record({ text: "6", total: 6, modifier: -3 })), "−3");

const oneNumber = "The axe bites deep for 12 damage.";
const oneRecord = [record({ text: "12", total: 12, index: 23 })];
assert.deepEqual(
  matchGameDicePlaceholders(oneNumber, oneRecord).map((match) => [match.start, match.end]),
  [[23, 25]],
);
assert.equal(
  applyGameDiceMarkers(oneNumber, oneRecord, describe),
  'The axe bites deep for <span class="game-dice-marker" title="2d6+3: 4 + 5 + 3 = 12 [+3]">12</span> damage.',
);

// THE OFFSET HAS MOVED. A tag ahead of the number was stripped, or the narration was split
// into segments, so `index` is nowhere near the truth. One unambiguous occurrence is still
// marked, because the text itself says which number it is.
assert.equal(
  applyGameDiceMarkers(oneNumber, [record({ text: "12", total: 12, index: 4_000 })], describe),
  'The axe bites deep for <span class="game-dice-marker" title="2d6+3: 4 + 5 + 3 = 12 [+3]">12</span> damage.',
);

// ── Everything ambiguous degrades to the plain number ────────────────────────
const twice = "It hits for 12, then for 12 again.";
assert.deepEqual(
  matchGameDicePlaceholders(twice, [record({ text: "12", total: 12, index: 9_999 })]),
  [],
  "two candidates and an offset that proves nothing: mark neither",
);
assert.equal(applyGameDiceMarkers(twice, [record({ text: "12", total: 12, index: 9_999 })], describe), twice);
// The offset never breaks a tie, even when it points straight at one candidate: it is in
// message coordinates and the text here is one segment, so the same hint that is right in
// this segment would claim an equal number in another.
assert.deepEqual(
  matchGameDicePlaceholders(twice, [record({ text: "12", total: 12, index: 12 })]),
  [],
  "an offset that happens to fit proves nothing either",
);
// Two records that rolled the same total mark neither, wherever each one sits.
assert.deepEqual(
  matchGameDicePlaceholders("It hits for 12, then for 12 again.", [
    record({ text: "12", total: 12, index: 9_000 }),
    record({ text: "12", total: 12, index: 9_100 }),
  ]),
  [],
);
// The cross-segment case those two rules exist for: two placeholders rolled the same total
// in different segments, and every segment is handed both records. Neither segment may let
// the first record claim its number, or the second segment shows the first roll's breakdown.
for (const segment of ["The axe bites for 12 damage.", "The burn lasts 12 rounds."]) {
  assert.deepEqual(
    matchGameDicePlaceholders(segment, [
      record({ text: "12", total: 12, index: 20 }),
      record({ text: "12", total: 12, index: 300 }),
    ]),
    [],
    segment,
  );
}
// A number that is part of a longer run is not this record's number.
assert.deepEqual(matchGameDicePlaceholders("You carry 1234 coins.", [record({ text: "12", total: 12 })]), []);
// A number inside a larger numeric token is not the number either: a decimal, a grouped
// thousand and a negative all contain a 12 that no record rolled.
for (const text of [
  "It costs 1.12 gold.",
  "It costs 12.5 gold.",
  "You carry 2,12 coins.",
  "You carry 12,000 coins.",
  "The temperature is -12 degrees.",
  "The temperature is −12 degrees.",
]) {
  assert.deepEqual(matchGameDicePlaceholders(text, [record({ text: "12", total: 12 })]), [], text);
}
// A separator with no digit on its far side is punctuation, and the number stays standalone.
assert.deepEqual(
  matchGameDicePlaceholders("It hits for 12.", [record({ text: "12", total: 12 })]).map((match) => [
    match.start,
    match.end,
  ]),
  [[12, 14]],
);
assert.deepEqual(
  matchGameDicePlaceholders("Hits for 12, then rests.", [record({ text: "12", total: 12 })]).map((match) => [
    match.start,
    match.end,
  ]),
  [[9, 11]],
);
// A negative record is matched with its sign, so the sign is not read as "inside a negative".
assert.deepEqual(
  matchGameDicePlaceholders("The penalty is -3 this round.", [record({ text: "-3", total: -3 })]).map((match) => [
    match.start,
    match.end,
  ]),
  [[15, 17]],
);
// A number inside a command tag is not the prose number, and a span opened inside one
// would break the formatter's read of the tag.
assert.deepEqual(
  matchGameDicePlaceholders('A [skill_check: skill="Athletics" total="12"] tag.', [record({ text: "12", total: 12 })]),
  [],
);
assert.deepEqual(matchGameDicePlaceholders("", [record({ text: "12", total: 12 })]), []);
assert.deepEqual(matchGameDicePlaceholders(oneNumber, null), []);
assert.deepEqual(matchGameDicePlaceholders(oneNumber, []), []);

// Two different numbers in one sentence are both marked, in reading order.
const twoNumbers = "It hits for 12 and burns for 3 rounds.";
assert.deepEqual(
  matchGameDicePlaceholders(twoNumbers, [
    record({ text: "12", total: 12, index: 12 }),
    record({
      raw: "1d4",
      notation: "1d4",
      rolls: [3],
      modifier: 0,
      modifierSource: "none",
      text: "3",
      total: 3,
      index: 29,
    }),
  ]).map((match) => match.start),
  [12, 29],
);

// The breakdown is escaped, because it is written into an attribute.
assert.match(
  applyGameDiceMarkers(oneNumber, oneRecord, () => 'a "quoted" <tag> & more'),
  /title="a &quot;quoted&quot; &lt;tag&gt; &amp; more"/,
);

// ── The route: the filter is in the chain, and only while the switch is on ───
const draft = "The axe bites deep for [[roll: 2d6+3]] damage, and the wound burns for [[roll: 1d4]] rounds.";
async function* scriptedChat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  // One character at a time, which is the worst case the filter has to survive.
  for (const character of draft) yield character;
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
    name: "Dice rendering fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  const chat = await chats.create({
    name: "Dice rendering",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, gameOneRequestDice: true });

  await chats.createMessage({ chatId: chat.id, role: "user", content: "Swing the axe." });
  const on = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(on.statusCode, 200, on.body);
  assert.ok(!on.body.includes('"type":"error"'), on.body);
  const tokenFrames = [...on.body.matchAll(/"type":"token","data":("(?:[^"\\]|\\.)*")/g)].map(
    (match) => JSON.parse(match[1]!) as string,
  );
  const streamed = tokenFrames.join("");
  assert.ok(streamed.length > 0, "the draft has to have streamed at all");
  assert.doesNotMatch(streamed, /\[/, `a bracket reached the player's view: ${streamed}`);
  assert.doesNotMatch(streamed, /roll:/i, streamed);
  assert.match(streamed, /The axe bites deep for/, streamed);
  assert.ok(on.body.includes('"type":"content_replace"'), "the finished text reaches the player through the replace");

  // The marker's records ride on the saved extra, never in the content.
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  const extra = JSON.parse(saved.extra) as { gameDiceTurn?: { placeholders?: PlaceholderRecord[] } };
  const records = extra.gameDiceTurn?.placeholders ?? [];
  assert.equal(records.length, 2);
  assert.doesNotMatch(saved.content, /game-dice-marker/, "the marker is a render-time wrapper, never saved content");
  for (const entry of records) {
    assert.equal(typeof entry.text, "string");
    assert.equal(saved.content.slice(entry.index, entry.index + entry.text.length), entry.text);
  }
  assert.equal(matchGameDicePlaceholders(saved.content, records).length, 2, "both numbers reattach to the saved text");

  // Switch off: the filter is not in the chain, so the spelling streams as written.
  await chats.patchMetadata(chat.id, { gameOneRequestDice: false });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Swing again." });
  const off = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(off.statusCode, 200, off.body);
  const offStreamed = [...off.body.matchAll(/"type":"token","data":("(?:[^"\\]|\\.)*")/g)]
    .map((match) => JSON.parse(match[1]!) as string)
    .join("");
  assert.match(offStreamed, /\[\[roll: 2d6\+3\]\]/, "nothing about an opted-out chat changes");
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalClaude;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

// ── The text-rewrite path, source-pinned ─────────────────────────────────────
// In a chat with a text-rewrite agent the token stream is suppressed entirely and the
// finished text arrives through the rewrite frame instead, so this filter is inert there
// and no content_replace is expected. That is a property of where the calls sit, so it is
// pinned where it lives rather than asserted through a scripted rewrite agent.
const routeSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  routeSource,
  /const chanceFiltered = gameChanceStreamFilter\?\.push\(commandFiltered\) \?\? commandFiltered;/,
  "the filter has to sit in the token chain, not beside it",
);
assert.match(
  routeSource,
  /if \(holdForTextRewrite\) \{\s*\n\s*recordReasoningDuration\(text\);\s*\n\s*\} else \{\s*\n\s*await sendTokenTextChunked\(text\);/,
  "a text-rewrite chat streams no tokens at all, which is what makes the filter inert there",
);
assert.match(
  routeSource,
  /if \(!holdForTextRewrite\) \{\s*\n(?:.*\n)*?\s*const pendingChanceText = gameChanceStreamFilter\?\.flush\(\) \?\? "";/,
  "and the flush is guarded the same way",
);

console.log("One-request dice: no placeholder reaches the player's view, and no number is marked by a guess.");
