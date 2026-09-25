// ──────────────────────────────────────────────
// One-request dice: the placeholder grammar and its resolution.
//
// `[[roll: 2d6+3]]` is a number the Game Master writes without seeing it. The engine
// rolls each one after the turn is written and substitutes the total, so a rolled turn
// finishes in one provider request and the model still never had a die in its prompt.
//
// Four claims are worth pinning, and every case below serves one of them.
//
//   1. EVERY OPENER PRODUCES A BOUNDED SPAN, AND EVERY BOUNDED SPAN IS REPLACED. This is
//      the whole reason the scan is an opener walk rather than a bounded regex. An
//      unterminated opener, a body past the cap, a body carrying a `]` and a nested
//      bracket are all spans a regex cannot match — and a span that is never matched
//      cannot be replaced, so it reaches saved content where the shipped unknown-tag
//      strippers half-eat it into a stray `[]`. Nothing here may leave one behind.
//   2. A NUMBER IS NEVER INVENTED. A body the engine cannot read becomes a short visible
//      notice, with nothing pushed to the dice history. Never a number, and never a
//      defaulted modifier: an unresolvable sheet name is refused rather than added as
//      zero, because a placeholder's name is only a modifier source and the player reads
//      the substituted number as fact.
//   3. THE TWO SHEET FORMS ARE NOT THE SAME SUM. `+STR` adds the attribute modifier and
//      nothing else; `+Athletics` adds the skill bonus PLUS its governing attribute's
//      modifier, which is what a skill check already does. That is asserted against
//      `resolveSkillCheckWithContext`'s own sum rather than against a transcribed number,
//      so the two paths cannot drift apart.
//   4. A PLACEHOLDER INSIDE A CLAIMED VERB'S ARGUMENT IS NEVER ROLLED. Not because the
//      scanner knows about verbs, but because of where the arm runs: the verb and its
//      whole argument are already gone by then. That ordering is the mechanism, so the
//      lane drives the real verb strip rather than asserting the comment.
//
// Plus the negative lane that keeps the feature opt-in: with the switch off, nothing in
// the turn pipeline touches the `[[roll:` spelling at all.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-dice-placeholders-"));
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
  gmVerbSchema,
  hasRollPlaceholder,
  parseRollPlaceholderBody,
  PLACEHOLDER_BODY_MAX,
  resolveRollPlaceholders,
  ROLL_UNAVAILABLE_TEXT,
  scanRollPlaceholders,
} = await import("../../packages/shared/dist/index.js");
const { createGameTurnChanceSession, resolveGameTurnPlaceholders, resolveSheetModifier, runGameTurnChancePass } =
  await import("../../packages/server/src/services/game/one-request-dice.js");
const { resolveSkillCheckWithContext } =
  await import("../../packages/server/src/services/game/skill-check-resolution.service.js");
const { parseAndStripGmVerbCalls } =
  await import("../../packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

/** A scripted die, so every substituted number below is a number this lane chose. */
function scriptedRoller(values: number[]): (sides: number) => number {
  let index = 0;
  return (sides) => {
    const value = values[index % values.length]!;
    index += 1;
    assert.ok(value >= 1 && value <= sides, `the script asked for ${value} on a d${sides}`);
    return value;
  };
}

// ── The span walk ───────────────────────────────────────────────────────────
// Each case is one shape a bounded regex could not see. `refusal` set at scan time means
// the span is already known to be unreadable before any grammar runs.
assert.equal(hasRollPlaceholder("plain prose"), false);
assert.equal(hasRollPlaceholder("a [[ROLL: 1d4]] here"), true, "the opener is case-insensitive");
assert.equal(hasRollPlaceholder('a [roll: character="Mari"] here'), false, "the Roleplay command is not claimed");

const wellFormed = scanRollPlaceholders("He swings for [[roll: 2d6+3]] damage.");
assert.equal(wellFormed.length, 1);
assert.equal(wellFormed[0]!.body, "2d6+3");
assert.equal(wellFormed[0]!.refusal, null);
assert.equal(
  "He swings for [[roll: 2d6+3]] damage.".slice(wellFormed[0]!.start, wellFormed[0]!.end),
  "[[roll: 2d6+3]]",
);

const unterminated = scanRollPlaceholders("Unclosed [[roll: 2d6] and then the rest.\nNext line.");
assert.equal(unterminated[0]!.refusal, "unterminated");
assert.ok(unterminated[0]!.end <= "Unclosed [[roll: 2d6] and then the rest.".length, "the span stops at the line end");

const capped = scanRollPlaceholders(`Body [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 1)}]] end.`);
assert.equal(capped[0]!.refusal, "over-long", "the cap is a rejection reason, not a matching precondition");
const atCap = scanRollPlaceholders(`Body [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX)}]] end.`);
assert.equal(atCap[0]!.refusal, null, "a body exactly at the cap is read, then refused by the grammar");

// A body built to make a repeated regex group backtrack: `d0+!` and then many ` +!`. A
// tail of the shape `(?:\s*[+-]\s*[^+\-\s][^+-]*)*` could divide each run of spaces
// between its iterations in exponentially many ways before refusing it; the character
// walk refuses it at once, and still tolerates the whitespace a real body carries.
{
  const hostile = `d0+!${" +!".repeat(200)}`;
  const started = performance.now();
  assert.equal(parseRollPlaceholderBody(hostile), null, "a run of malformed terms is refused");
  assert.ok(performance.now() - started < 2_000, "and refused in linear time");
  assert.equal(
    parseRollPlaceholderBody(`2d6${" ".repeat(40)}+${" ".repeat(40)}3`)?.dice.modifier,
    3,
    "whitespace around a sign is still tolerated",
  );
}

// A line of openers that never close. Each one is bounded by the cap, and the walk must
// not search the whole suffix for a `]]` from every one of them: the scan remembers that
// nothing lies ahead, so the wall is bounded in linear time.
{
  const wall = "[[roll:".repeat(60_000);
  const started = performance.now();
  const spans = scanRollPlaceholders(wall);
  assert.ok(performance.now() - started < 5_000, "a wall of unterminated openers is bounded in linear time");
  assert.ok(spans.length > 0 && spans.every((span) => span.refusal === "unterminated"));
  // The same wall with one closer at the very end: the first span runs to it and is
  // refused as over-long, and the walk resumes past it rather than inside it.
  const closedWall = scanRollPlaceholders(`${wall}]] tail`);
  assert.equal(closedWall.length, 1);
  assert.equal(closedWall[0]!.refusal, "over-long");
}

const nested = scanRollPlaceholders("Odd [[roll: 2d6 [x]]] here.");
assert.equal(nested[0]!.end, "Odd [[roll: 2d6 [x]]]".length, "the trailing bracket run is swallowed whole");
const bracketBody = scanRollPlaceholders("Odd [[roll: 2d6]x]] here.");
assert.equal(bracketBody[0]!.refusal, "closing-bracket");
const nestedOpener = scanRollPlaceholders("Nested [[roll: [[roll: 2d6]]]] here.");
assert.equal(nestedOpener.length, 1, "the walk resumes past a consumed span, never inside it");
assert.equal(nestedOpener[0]!.end, "Nested [[roll: [[roll: 2d6]]]]".length);

const many = scanRollPlaceholders("Two [[roll: 1d4]] then [[roll: 1d6]].");
assert.deepEqual(
  many.map((span) => span.body),
  ["1d4", "1d6"],
  "several per line, in reading order",
);

// ── The body grammar ────────────────────────────────────────────────────────
for (const [body, count, sides, modifier, name] of [
  ["d6", 1, 6, 0, null],
  ["2d6+3", 2, 6, 3, null],
  ["4d8-1", 4, 8, -1, null],
  ["1d8+STR", 1, 8, 0, "STR"],
  ["2d6+Athletics", 2, 6, 0, "Athletics"],
  ["2d6+3+STR", 2, 6, 3, "STR"],
  ["2d6+STR+3", 2, 6, 3, "STR"],
  ["1d8-STR", 1, 8, 0, "STR"],
  ["2d6 + 3", 2, 6, 3, null],
  ["2d6+Sleight of Hand", 2, 6, 0, "Sleight of Hand"],
] as Array<[string, number, number, number, string | null]>) {
  const parsed = parseRollPlaceholderBody(body);
  assert.ok(parsed, `${body} should parse`);
  assert.equal(parsed.dice.count, count, body);
  assert.equal(parsed.dice.sides, sides, body);
  assert.equal(parsed.dice.modifier, modifier, body);
  assert.equal(parsed.sheetName, name, body);
}
assert.equal(parseRollPlaceholderBody("1d8-STR")!.sheetSign, -1, "a minus subtracts what a plus would add");
for (const body of [
  "no dice",
  "0d6",
  "d0",
  "1d6+9007199254740991",
  "1d8+1d6",
  "2d6+3+4",
  "2d6+STR+DEX",
  "",
  "2d6 [x",
  "2d6+",
]) {
  assert.equal(parseRollPlaceholderBody(body), null, `${body} is not a readable placeholder body`);
}

// ── Resolution, with a scripted die ─────────────────────────────────────────
const flat = resolveRollPlaceholders("He swings for [[roll: 2d6+3]] damage.", { nextValue: scriptedRoller([4, 5]) });
assert.equal(flat.content, "He swings for 12 damage.");
assert.equal(flat.changed, true);
assert.equal(flat.refusals.length, 0);
assert.deepEqual(flat.records[0]!.rolls, [4, 5]);
assert.equal(flat.records[0]!.raw, "2d6+3", "the body is kept verbatim for audit");
assert.equal(flat.records[0]!.notation, "2d6+3");
assert.equal(flat.records[0]!.modifier, 3);
assert.equal(flat.records[0]!.modifierSource, "flat");
assert.equal(flat.records[0]!.total, 12);
assert.equal(flat.records[0]!.text, "12");
assert.equal(
  flat.content.slice(flat.records[0]!.index, flat.records[0]!.index + 2),
  "12",
  "the offset points at the substituted number in the text this returned",
);

const single = resolveRollPlaceholders("The wound burns for [[roll: d4]] rounds.", { nextValue: scriptedRoller([3]) });
assert.equal(single.content, "The wound burns for 3 rounds.");
assert.equal(single.records[0]!.modifierSource, "none");

const pair = resolveRollPlaceholders("Two [[roll: 1d4]] then [[roll: 1d6]].", { nextValue: scriptedRoller([2, 5]) });
assert.equal(pair.content, "Two 2 then 5.", "several in one sentence resolve in reading order");
assert.equal(pair.records.length, 2);
assert.equal(pair.content.slice(pair.records[1]!.index, pair.records[1]!.index + 1), "5");

// Markdown and quotes: a flat text walk, with the surrounding markup untouched.
for (const [raw, expected] of [
  ["**[[roll: 2d6]] damage**", "**9 damage**"],
  ["> A blockquote with [[roll: 2d6]] in it.", "> A blockquote with 9 in it."],
  ["- A list item worth [[roll: 2d6]] gold", "- A list item worth 9 gold"],
  ['[Kaeya] [smirk]: "That\'ll be [[roll: 2d6]] crowns."', '[Kaeya] [smirk]: "That\'ll be 9 crowns."'],
  ["| cell | [[roll: 2d6]] |", "| cell | 9 |"],
]) {
  const markdown = resolveRollPlaceholders(raw!, { nextValue: scriptedRoller([4, 5]) });
  assert.equal(markdown.content, expected, raw);
}

// Clamped, not refused: this path's shipped policy is that an oversized notation still
// rolls, and the record names the dice actually thrown rather than the ones asked for.
const clamped = resolveRollPlaceholders("A storm of [[roll: 500d6]] hail.", { nextValue: scriptedRoller([1]) });
assert.deepEqual(clamped.clamps, [{ requested: "500d6", thrown: "100d6" }]);
assert.equal(clamped.records[0]!.rolls.length, 100);
assert.equal(clamped.records[0]!.notation, "100d6");
assert.equal(clamped.content, "A storm of 100 hail.");

// ── Every refusal, and what it leaves behind ────────────────────────────────
const refusalCases: Array<[string, string]> = [
  ["A [[roll: no dice]] here.", "notation"],
  ["A [[roll: 0d6]] here.", "notation"],
  ["A [[roll: d0]] here.", "notation"],
  ["A [[roll: 1d6+9007199254740991]] here.", "notation"],
  ["A [[roll: 1d8+1d6]] here.", "notation"],
  [`A [[roll: ${"9".repeat(PLACEHOLDER_BODY_MAX + 1)}]] here.`, "over-long"],
  ["A [[roll: 2d6]x]] here.", "closing-bracket"],
  ["A [[roll: 2d6 here.", "unterminated"],
  ["A [[roll: 2d6 [x]]] here.", "notation"],
  ["A [[roll: [[roll: 2d6]]]] here.", "notation"],
];
for (const [raw, reason] of refusalCases) {
  const refused = resolveRollPlaceholders(raw, {
    nextValue: () => {
      throw new Error("a refused placeholder must never reach the die");
    },
  });
  assert.equal(refused.refusals.length, 1, raw);
  assert.equal(refused.refusals[0]!.reason, reason, raw);
  assert.equal(refused.records.length, 0, `nothing is recorded for ${raw}`);
  assert.ok(refused.content.includes(ROLL_UNAVAILABLE_TEXT), refused.content);
  assert.doesNotMatch(refused.content, /\[|\]/, `a bracket survived into saved content: ${refused.content}`);
  assert.doesNotMatch(refused.content, /\d/, `a number survived into saved content: ${refused.content}`);
}
// The stated cost of bounding an unterminated opener: it can take a few words of its own
// line with it. The next line is never touched.
const bounded = resolveRollPlaceholders("A [[roll: 2d6 and more words.\nThe next line survives.", {
  nextValue: scriptedRoller([1]),
});
assert.equal(bounded.content, `A ${ROLL_UNAVAILABLE_TEXT}\nThe next line survives.`);

// ── The two sheet forms ─────────────────────────────────────────────────────
// STR 14 (+2), Athletics +3, and a governing attribute the skill form must also add.
const sheet: SkillCheckModifierContext = {
  skills: { Athletics: 3 },
  attributes: null,
  sheetAttributes: { str: 14, dex: 8 },
};
assert.deepEqual(resolveSheetModifier(sheet, "STR"), { value: 2, source: "attribute" });
assert.deepEqual(
  resolveSheetModifier(sheet, "strength"),
  { value: 2, source: "attribute" },
  "names fold like the sheet",
);
assert.deepEqual(resolveSheetModifier(sheet, "DEX"), { value: -1, source: "attribute" });
assert.deepEqual(resolveSheetModifier(sheet, "Athletics"), { value: 5, source: "skill" });
assert.equal(
  resolveSheetModifier(sheet, "Athletics")!.value,
  resolveSkillCheckWithContext(sheet, { skill: "Athletics", dc: 10 }, () => 1).modifier,
  "the skill form is the check path's own sum: skill bonus PLUS the governing attribute",
);
assert.equal(resolveSheetModifier(sheet, "Perception"), null, "an unknown name is refused, never defaulted to zero");
assert.equal(resolveSheetModifier(sheet, "CON"), null, "an attribute the sheet does not carry is refused too");
assert.equal(
  resolveSheetModifier({ skills: null, attributes: null, sheetAttributes: {} }, "Athletics"),
  null,
  "the default configuration seeds no snapshot, so a skill name resolves to nothing at all",
);
assert.deepEqual(
  resolveSheetModifier({ skills: null, attributes: { str: 20 }, sheetAttributes: { str: 8 } }, "STR"),
  { value: 5, source: "attribute" },
  "the snapshot's engine-shape attributes win over the card's sheet, exactly as a check reads them",
);

const withSheet = (content: string, values: number[]) =>
  resolveRollPlaceholders(content, {
    nextValue: scriptedRoller(values),
    resolveSheetName: (name) => resolveSheetModifier(sheet, name),
  });
const attributeForm = withSheet("The blade bites for [[roll: 1d8+STR]].", [6]);
assert.equal(attributeForm.content, "The blade bites for 8.");
assert.equal(attributeForm.records[0]!.modifier, 2, "+STR adds attributeModifier(score) and nothing else");
assert.equal(attributeForm.records[0]!.modifierSource, "attribute");
assert.equal(attributeForm.records[0]!.notation, "1d8+2");
assert.equal(attributeForm.records[0]!.raw, "1d8+STR", "the record keeps the name the model wrote");

const skillForm = withSheet("You haul yourself up for [[roll: 2d6+Athletics]].", [4, 5]);
assert.equal(skillForm.content, "You haul yourself up for 14.");
assert.equal(skillForm.records[0]!.modifier, 5);
assert.equal(skillForm.records[0]!.modifierSource, "skill");

const bothTerms = withSheet("A [[roll: 2d6+3+STR]] swing.", [4, 5]);
assert.equal(bothTerms.records[0]!.modifier, 5, "the flat term and the sheet term are summed");
assert.equal(bothTerms.content, "A 14 swing.");
assert.equal(withSheet("A [[roll: 2d6+STR+3]] swing.", [4, 5]).content, "A 14 swing.", "either order reads the same");
assert.equal(withSheet("A [[roll: 1d8-STR]] graze.", [6]).content, "A 4 graze.", "a minus subtracts the same modifier");

const unknownName = withSheet("A [[roll: 2d6+Perception]] check.", [4, 5]);
assert.equal(unknownName.content, `A ${ROLL_UNAVAILABLE_TEXT} check.`);
assert.equal(unknownName.refusals[0]!.reason, "unresolved-name");
assert.equal(unknownName.refusals[0]!.name, "Perception");
assert.equal(unknownName.records.length, 0, "an unresolvable name rolls nothing at all");
const noNames = resolveRollPlaceholders("A [[roll: 2d6+Athletics]] check.", { nextValue: scriptedRoller([4, 5]) });
assert.equal(
  noNames.content,
  `A ${ROLL_UNAVAILABLE_TEXT} check.`,
  "with no sheet resolver at all, a name written anyway is refused rather than rolled at +0",
);

// ── The arm, the session and the ledger ─────────────────────────────────────
const session = createGameTurnChanceSession({
  db: null as never,
  chatId: "lane",
  roll: scriptedRoller([4, 5]),
  loadModifierContext: () => Promise.resolve(sheet),
});
const armed = await runGameTurnChancePass(
  "The axe bites for [[roll: 2d6+3]] damage, and a [[roll: 2d6+Nothing]] miss.",
  session,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.equal(armed.changed, true, "the caller is told to set contentReplaced");
assert.equal(armed.content, `The axe bites for 12 damage, and a ${ROLL_UNAVAILABLE_TEXT} miss.`);
assert.equal(session.failed, false);
assert.deepEqual(session.diceRolls, [{ notation: "2d6+3", rolls: [4, 5], modifier: 3, total: 12 }]);
assert.equal(session.placeholders.length, 1, "only the resolved placeholder is recorded");
assert.deepEqual(
  session.ledger.map((entry) => entry.outcome),
  ["resolved", "unreadable"],
  "the ledger keeps the order things happened in",
);

const cleanSession = createGameTurnChanceSession({
  db: null as never,
  chatId: "lane",
  loadModifierContext: () => {
    throw new Error("a turn with no placeholder must never read the sheet");
  },
});
const clean = await runGameTurnChancePass(
  "Plain prose, no numbers.",
  cleanSession,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.equal(clean.changed, false);
assert.equal(clean.content, "Plain prose, no numbers.");

let sheetReads = 0;
const sharedSheetSession = createGameTurnChanceSession({
  db: null as never,
  chatId: "lane",
  roll: scriptedRoller([3]),
  loadModifierContext: () => {
    sheetReads += 1;
    return Promise.resolve(sheet);
  },
});
await runGameTurnChancePass(
  "A [[roll: 1d6+STR]] and a [[roll: 1d6+STR]].",
  sharedSheetSession,
  resolveGameTurnPlaceholders,
  "placeholder",
);
await runGameTurnChancePass(
  "Another [[roll: 1d6+STR]].",
  sharedSheetSession,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.equal(sheetReads, 1, "N placeholders in one turn must not mean N snapshot reads");

// A turn of pure flat damage never reads a sheet at all, which is what keeps the default
// configuration — agents off, so no game-state row was ever written — off the database.
const noSheetSession = createGameTurnChanceSession({
  db: null as never,
  chatId: "lane",
  roll: scriptedRoller([3]),
  loadModifierContext: () => {
    throw new Error("a placeholder that names no modifier must never read the sheet");
  },
});
const flatOnly = await runGameTurnChancePass(
  "Straight [[roll: 1d6+2]] damage.",
  noSheetSession,
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.equal(flatOnly.content, "Straight 5 damage.");
assert.equal(noSheetSession.failed, false);

// ── A placeholder inside a claimed verb's argument ──────────────────────────
// The arm runs AFTER the verb strip, so this is gone with the verb rather than skipped
// by a rule the scanner cannot implement. Driven through the real strip, because the
// ordering is the mechanism.
const verbTable = {
  packageId: "lane-package",
  verbs: [
    gmVerbSchema.parse({
      name: "weather",
      description: "Set the weather",
      effect: "event",
      args: [{ name: "note", type: "string", maxLength: 200 }],
    }),
  ],
};
const draftWithVerb = 'Rain rolls in. [weather:{"note":"[[roll: 2d6]] rain"}] You shiver for [[roll: 1d4]] rounds.';
const verbScan = parseAndStripGmVerbCalls(draftWithVerb, verbTable);
assert.equal(verbScan.calls.length, 1);
assert.equal(
  verbScan.calls[0]!.args.note,
  "[[roll: 2d6]] rain",
  "the verb's argument reaches the package exactly as written, carrying no rolled number",
);
const afterVerbs = await runGameTurnChancePass(
  verbScan.content,
  createGameTurnChanceSession({
    db: null as never,
    chatId: "lane",
    roll: scriptedRoller([2]),
    loadModifierContext: () => Promise.resolve(sheet),
  }),
  resolveGameTurnPlaceholders,
  "placeholder",
);
assert.match(afterVerbs.content, /You shiver for 2 rounds\./, "the prose placeholder still resolves");
assert.doesNotMatch(afterVerbs.content, /\[\[roll:/i, "and the one inside the verb is simply gone");
assert.doesNotMatch(afterVerbs.content, /weather/i);

// ── The route, on both sides of the switch ──────────────────────────────────
const calls: ChatMessage[][] = [];
const draft = "The axe bites deep for [[roll: 2d6+3]] damage, and the wound burns for [[roll: 1d4]] rounds.";
/** What the next scripted turn writes. A continuation needs a SECOND segment of its own. */
let scriptedDraft = draft;
async function* scriptedChat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  calls.push(structuredClone(messages));
  assert.equal(options.tools, undefined, "subscription transports never receive native tool schemas");
  yield scriptedDraft;
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
    name: "Placeholder fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  const chat = await chats.create({
    name: "Dice placeholders",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  // The configuration the repo's own dice lane runs in: no agents, no tools, and so no
  // game-state snapshot at all.
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, gameOneRequestDice: true });

  await chats.createMessage({ chatId: chat.id, role: "user", content: "Swing the axe." });
  calls.length = 0;
  const on = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(on.statusCode, 200, on.body);
  assert.ok(!on.body.includes('"type":"error"'), on.body);
  assert.equal(calls.length, 1, "a turn full of placeholders is still one provider request");
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  assert.doesNotMatch(saved.content, /\[\[roll:/i, `a raw span reached saved content: ${saved.content}`);
  const substituted = /bites deep for (\d+) damage/.exec(saved.content);
  assert.ok(substituted, `the number was not substituted: ${saved.content}`);
  const damage = Number(substituted[1]);
  assert.ok(damage >= 5 && damage <= 15, `2d6+3 rolled outside its range: ${damage}`);
  assert.match(saved.content, /burns for (\d+) rounds/, saved.content);

  const extra = JSON.parse(saved.extra) as {
    diceRollResults?: Array<{ notation: string; rolls: number[]; total: number }>;
    gameDiceTurn?: { forms?: string[]; placeholders?: Array<{ raw: string; total: number }> };
  };
  assert.equal(extra.diceRollResults?.length, 2, "each substituted placeholder is a real roll in the dice history");
  assert.equal(extra.diceRollResults![0]!.notation, "2d6+3");
  assert.equal(extra.diceRollResults![0]!.rolls.length, 2);
  assert.equal(extra.diceRollResults![0]!.total, damage);
  assert.deepEqual(extra.gameDiceTurn?.forms, ["placeholder"]);
  assert.equal(extra.gameDiceTurn?.placeholders?.length, 2, "the turn log keeps the raw placeholder for audit");
  assert.equal(extra.gameDiceTurn!.placeholders![0]!.raw, "2d6+3");
  assert.ok(
    !on.body.includes('"name":"roll_dice"'),
    "a placeholder roll emits no tool_result frame: a full-screen dice card would bury the narration",
  );
  assert.ok(on.body.includes('"type":"content_replace"'), "the corrected text has to reach the streamed view");

  // ── A continuation extends the record rather than replacing it ────────────
  // A continuation writes into the SAME message and the SAME swipe, and a message-extra
  // update is a shallow merge. A record written only when the new segment produced one of
  // its own would drop the first segment's placeholders, and with them the inline
  // breakdown on numbers the player already read and every log line saying what could not
  // be rolled. The sibling dice history retains the earlier segment for the same reason.
  scriptedDraft = "You stagger for [[roll: 1d4]] more rounds.";
  calls.length = 0;
  const continued = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, continueMessageId: saved.id },
  });
  assert.equal(continued.statusCode, 200, continued.body);
  assert.ok(!continued.body.includes('"type":"error"'), continued.body);
  assert.equal(calls.length, 1, "a continuation that rolls is still one provider request");
  const extended = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(extended.id, saved.id, "the continuation wrote into the same message");
  assert.doesNotMatch(extended.content, /\[\[roll:/i, extended.content);
  const continuedExtra = JSON.parse(extended.extra) as {
    diceRollResults?: unknown[];
    gameDiceTurn?: { forms?: string[]; placeholders?: Array<{ raw: string }> };
  };
  assert.deepEqual(
    continuedExtra.gameDiceTurn?.placeholders?.map((record) => record.raw),
    ["2d6+3", "1d4", "1d4"],
    "the first segment's placeholder records survive the second segment's write",
  );
  assert.deepEqual(continuedExtra.gameDiceTurn?.forms, ["placeholder"]);
  assert.equal(continuedExtra.diceRollResults?.length, 3, "and the dice history keeps all three rolls");
  scriptedDraft = draft;

  // Switch off: every resolver leaves the spelling completely alone, so nothing about an
  // already-saved transcript can change under a player who never turned this on.
  await chats.patchMetadata(chat.id, { gameOneRequestDice: false });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Swing again." });
  calls.length = 0;
  const off = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(off.statusCode, 200, off.body);
  assert.ok(!off.body.includes('"type":"error"'), off.body);
  assert.equal(calls.length, 1, "with no roll tag there was never a rewrite to make");
  const untouched = (await chats.listMessages(chat.id)).at(-1)!;
  assert.match(untouched.content, /\[\[roll: 2d6\+3\]\]/, "the placeholder is left exactly as the model wrote it");
  assert.match(untouched.content, /\[\[roll: 1d4\]\]/, untouched.content);
  assert.equal(JSON.parse(untouched.extra).gameDiceTurn, undefined);
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalClaude;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("One-request dice: every placeholder is rolled or replaced, and no malformed span reaches saved content.");
