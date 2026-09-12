/**
 * GM skill checks are rolled by the engine, not by the model.
 *
 * The GM used to write the whole check itself — die, modifier, total, outcome —
 * and the engine only ever second-guessed the first plain d20 in a turn, on the
 * client, after the fact. Two holes followed: a turn with three checks resolved
 * one, and a check whose invented arithmetic failed the audit had its numbers
 * corrected on the dice card while the invention stayed in the saved text for
 * the next turn to read back as fact.
 *
 * Now the GM emits checks sparse, and generation post-processing rolls every
 * tag that still owes a roll — sparse or self-reported-and-wrong — before the
 * turn reaches the client or the database. This pins that: all N resolved, the
 * player's own die and advantage mode preserved, honest tags left byte-identical,
 * a second pass rolling nothing, the legacy client fallback still able to fire
 * for old messages, and the prompt still telling the GM not to invent numbers.
 *
 * It also pins the boundary of that authority. The engine rolls d20 checks and
 * nothing else, so a tag naming a system it does not implement is left standing
 * — including a malformed one, which looks identical to a sparse d20 request
 * once the reader refuses to vouch for its numbers.
 *
 * And it pins the three ways that authority can be honest and still get the
 * answer wrong:
 *
 *   - A tag declaring advantage AND disadvantage names no system at all. The
 *     roller cancels the pair and throws one die, so passing the tag as rollable
 *     turned a declared `dice="2d20"` into a saved `dice="1d20"`.
 *   - A roll that CANNOT happen — the chat's modifiers failing to load — used to
 *     leave the turn saved exactly as the model wrote it, invented rolls, total
 *     and result included. The error path is not a licence to save the invention.
 *   - The player's sheet is found by who the player is, not by which card sits
 *     first in an array that recruiting and removal reorder.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  formatSkillCheckResultSummary,
  isEngineRollableSkillCheckTag,
  parseSkillCheckTagBody,
  serializeResolvedSkillCheckTag,
} from "../../packages/shared/dist/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";
import { parseGmTags } from "../../packages/client/src/lib/game-tag-parser.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// The last lane drives a REAL chat and a REAL persona, because "the player's card
// is found by identity" is a claim about stored state and nothing smaller proves
// it. Every server import is therefore made AFTER DATA_DIR points at a scratch
// directory: `runtime-config.ts` reads it once at module load, and a static
// import would have run that read against the developer's own install. Only the
// type import above is static, and a type import is erased before it can.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-gm-skill-check-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousMarinaraFileStorageDir = process.env.MARINARA_FILE_STORAGE_DIR;
const fileStorageDir = join(dataDir, "file-storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

const [
  { loadSkillCheckModifierContext, resolveSkillCheckTagsInContent },
  { stripGmCommandTags },
  { buildGmFormatReminder },
  { createChatsStorage },
  { createCharactersStorage },
  { getDB, closeDB },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/segment-edits.js"),
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/server/src/services/storage/characters.storage.js"),
  import("../../packages/server/src/db/connection.js"),
]);

// Stealth: +2 from the snapshot's skills, +2 from a DEX 14 sheet attribute.
// Perception is unlisted, so it earns the WIS 10 sheet attribute's +0.
const CONTEXT: SkillCheckModifierContext = {
  skills: { Stealth: 2 },
  attributes: null,
  sheetAttributes: { dex: 14, wis: 10 },
};

/** A d20 the test owns, so "the engine rolled it" is a checkable claim. */
function scriptedD20(values: number[]) {
  let index = 0;
  const roll = () => {
    assert.ok(index < values.length, `resolver asked for more dice than the script holds (${values.length})`);
    return values[index++]!;
  };
  return { roll, consumed: () => index };
}

async function resolve(content: string, dice: number[], contextOverride?: SkillCheckModifierContext) {
  const die = scriptedD20(dice);
  let contextLoads = 0;
  const outcome = await resolveSkillCheckTagsInContent(content, {
    loadContext: async () => {
      contextLoads += 1;
      return contextOverride ?? CONTEXT;
    },
    rollD20: die.roll,
    chatId: "chat-regression",
  });
  return { ...outcome, consumed: die.consumed(), contextLoads };
}

function tagBodies(content: string): string[] {
  return Array.from(content.matchAll(/\[skill_check:\s*([^\]]+)\]/gi)).map((match) => match[1]!);
}

// ── 1. Every sparse check in a turn is rolled, not just the first ──

const threeChecks = [
  `You press yourself flat against the crates. [skill_check: skill="Stealth" dc="15"]`,
  `The lantern swings past. [skill_check: skill="Perception" dc="10"]`,
  `You reach for the latch. [skill_check: skill="Stealth" dc="12"]`,
].join("\n\n");

const sparse = await resolve(threeChecks, [5, 17, 1]);
assert.equal(sparse.resolved, 3, "all three sparse checks must be rolled, not just the first");
assert.equal(sparse.trusted, 0);
assert.equal(sparse.consumed, 3, "one die per sparse check");
assert.equal(sparse.contextLoads, 1, "the chat's modifiers are read once for the whole turn");

const sparseTags = tagBodies(sparse.content).map((body) => parseSkillCheckTagBody(body));
assert.equal(sparseTags.length, 3);
for (const tag of sparseTags) {
  assert.ok(tag?.resolvedResult, "a resolved tag must read back as resolved");
  const rolled = tag.resolvedResult!;
  assert.equal(rolled.rolls.length, 1);
  assert.ok(rolled.usedRoll >= 1 && rolled.usedRoll <= 20, `d20 out of range: ${rolled.usedRoll}`);
  assert.equal(rolled.rolls[0], rolled.usedRoll);
  assert.equal(rolled.usedRoll + rolled.modifier, rolled.total, "the written arithmetic must hold");
}
// The dice the script handed out, in the order the tags appear.
assert.deepEqual(
  sparseTags.map((tag) => tag!.resolvedResult!.usedRoll),
  [5, 17, 1],
  "each tag is resolved with the engine's own die, in reading order",
);
// Each tag keeps its own request. Two Stealth checks at different DCs in one
// turn must not end up sharing a DC because the splice matched the wrong tag.
assert.deepEqual(
  sparseTags.map((tag) => [tag!.resolvedResult!.skill, tag!.resolvedResult!.dc]),
  [
    ["Stealth", 15],
    ["Perception", 10],
    ["Stealth", 12],
  ],
  "every tag is resolved against its own skill and DC, not a neighbour's",
);
// Modifiers come from the chat, so a resolved check is not just a bare die.
assert.equal(sparseTags[0]!.resolvedResult!.modifier, 4, "Stealth: +2 skill, +2 from DEX 14");
assert.equal(sparseTags[1]!.resolvedResult!.modifier, 0, "Perception: unlisted skill, WIS 10");
// Outcomes follow from the numbers, including the natural-1 rule.
assert.equal(sparseTags[0]!.resolvedResult!.success, false, "5 + 4 misses DC 15");
assert.equal(sparseTags[1]!.resolvedResult!.success, true, "17 clears DC 10");
assert.equal(sparseTags[2]!.resolvedResult!.criticalFailure, true, "a natural 1 fails regardless of modifiers");
// Prose survives untouched.
assert.match(sparse.content, /You press yourself flat against the crates\./u);
assert.match(sparse.content, /The lantern swings past\./u);
assert.match(sparse.content, /You reach for the latch\./u);

// ── 2. A full tag whose arithmetic fails the audit is overwritten ──
//
// This is the bug the feature exists for. The GM reported a 7 and a total of
// 19; before this change the honest re-roll reached the dice card and the
// invention stayed in the transcript.

const invented = `The guard turns. [skill_check: skill="Perception" dc="12" rolls="7" modifier="0" total="19" result="success" mode="normal" resolution="sum" dice="1d20"] He does not see you.`;
const overwritten = await resolve(invented, [11]);
assert.equal(overwritten.resolved, 1, "a self-reported check that fails its audit must be re-rolled");
assert.equal(overwritten.trusted, 0);
assert.equal(overwritten.consumed, 1);
assert.doesNotMatch(overwritten.content, /total="19"/u, "the invented total must not survive in the saved text");
assert.doesNotMatch(overwritten.content, /rolls="7"/u, "the invented die must not survive in the saved text");
const overwrittenTag = parseSkillCheckTagBody(tagBodies(overwritten.content)[0]!);
assert.equal(overwrittenTag?.resolvedResult?.usedRoll, 11);
assert.equal(overwrittenTag?.resolvedResult?.total, 11, "Perception earns no modifier from this sheet");
assert.equal(
  overwrittenTag?.resolvedResult?.success,
  false,
  "11 misses DC 12 — the honest outcome, not the claimed one",
);
assert.match(overwritten.content, /The guard turns\./u);
assert.match(overwritten.content, /He does not see you\./u);

// ── 3. A full tag whose arithmetic holds is left byte-identical ──

const honest = `[skill_check: skill="Perception" dc="12" rolls="14" modifier="3" total="17" result="success" mode="normal" resolution="sum" dice="1d20"]`;
const kept = await resolve(honest, []);
assert.equal(kept.content, honest, "an honest check must not be re-rolled");
assert.equal(kept.resolved, 0);
assert.equal(kept.trusted, 1);
assert.equal(kept.consumed, 0, "no die is thrown for a check the engine trusts");
assert.equal(kept.contextLoads, 0, "a turn with nothing to roll must not read the chat at all");

// A dice pool is a rules system the engine does not implement, so it is never
// audited and never rewritten — the alternative is silently converting a V20
// check into a d20 one.
const pool = `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10|5" modifier="0" total="3" result="failure" mode="normal" resolution="successes" dice="6d10"]`;
const poolKept = await resolve(pool, []);
assert.equal(poolKept.content, pool, "pool systems are left exactly as the GM wrote them");
assert.equal(poolKept.resolved, 0);
assert.equal(poolKept.trusted, 1);

// The half of that promise the audit cannot keep on its own. A pool tag the
// reader refuses to vouch for comes back in exactly the same shape as a sparse
// d20 request — skill and DC, no resolvedResult — so a resolver that reads an
// absent resolvedResult as "roll it" answers a V20 check with one engine d20 and
// writes the GM's notation out of the message before it is ever saved.
const unvouchedPools = [
  // Six dice declared, five listed.
  `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10" modifier="0" total="3" result="failure" mode="normal" resolution="successes" dice="6d10"]`,
  // An 11 on a d10.
  `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|11|5" modifier="0" total="3" result="failure" mode="normal" resolution="successes" dice="6d10"]`,
  // No modifier=.
  `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10|5" total="3" result="failure" mode="normal" resolution="successes" dice="6d10"]`,
  // No result=.
  `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10|5" modifier="0" total="3" mode="normal" resolution="successes" dice="6d10"]`,
  // A success pool with no dice= label at all.
  `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10|5" resolution="successes"]`,
  // A lone d10 result, which must never be adopted as a player's d20 pre-roll.
  `[skill_check: skill="Stealth" dc="8" rolls="7" resolution="successes" dice="1d10"]`,
  // A pool asked for and not yet thrown.
  `[skill_check: skill="Stealth" dc="12" dice="6d10" resolution="successes"]`,
  // Another die, summed rather than counted — still not a system the engine has.
  `[skill_check: skill="Athletics" dc="10" dice="3d6"]`,
  // Labels this reader cannot restate, so it must not restate them. The second
  // is a d20 — but with a flat bonus the engine has no way to keep, since its
  // modifier comes from the sheet.
  `[skill_check: skill="Stealth" dc="12" dice="6d10+2"]`,
  `[skill_check: skill="Stealth" dc="15" dice="1d20+3"]`,
  // A count the engine cannot restate either. Two d20s are what advantage and
  // disadvantage throw, and the engine labels those itself; two d20s summed for a
  // straight check is someone else's system, and answering it with one die and a
  // `dice="1d20"` label is the same silent rewrite as answering a pool with a d20.
  `[skill_check: skill="Stealth" dc="15" dice="2d20"]`,
  // The mirror: a mode that needs two dice, declared over a label that names one.
  `[skill_check: skill="Stealth" dc="15" dice="1d20" mode="advantage"]`,
  `[skill_check: skill="Stealth" dc="15" dice="1d20" mode="disadvantage"]`,
  // Spacing around `=` decides nothing about what the GM meant, so it must not
  // decide whether the declarations are seen at all. With both of them spaced and
  // skill/dc not, the reader used to come back with skill and DC alone — a sparse
  // d20 request, indistinguishable from the real thing — and this pool was rolled
  // as `1d20` and relabelled `resolution="sum"` in the text about to be saved.
  `[skill_check: skill="Stealth" dc="12" dice = "6d10" resolution = "successes"]`,
  `[skill_check: skill = "Stealth" dc = "12" dice = "6d10" resolution = "successes"]`,
  `[skill_check: skill="Stealth" dc="12" dice\n= "6d10" resolution\n= "successes"]`,
  // An unquoted value reached across the space is still a declaration. This pair
  // is what stops the hole below from being closed by the blunter rule — "an
  // unquoted value must touch the `=`" — which would close it by making these
  // two unreadable again, and an unread `dice="6d10"` is a pool handed to a d20.
  `[skill_check: skill="Stealth" dc="12" dice = 6d10]`,
  `[skill_check: skill="Stealth" dc="12" dice = 6d10 resolution = successes]`,
  // …and the same hole approached from the other side. An attribute written with
  // no value must declare nothing and consume nothing: reading its value across
  // the space swallowed the declaration after it whole, so `dice=` stopped
  // existing as far as the guard could tell and the pool was answered with an
  // engine d20 and relabelled `resolution="sum" dice="1d20"` — the swallowing key
  // is any key, and the pool it eats is the last one standing.
  `[skill_check: skill="Stealth" dc="12" mode= dice="6d10"]`,
  `[skill_check: skill="Stealth" dc="12" used= dice="6d10"]`,
  `[skill_check: skill="Athletics" dc="10" note= dice="3d6"]`,
  `[skill_check: skill="Stealth" dc="12" mode=\ndice="6d10"]`,
  // A swallowed `resolution=` is the same class; it happened to refuse already,
  // because the garbage it swallowed was not the word "sum".
  `[skill_check: skill="Stealth" dc="12" resolution= dice="6d10"]`,
  // The declaration the empty value cannot reach, either because something else
  // survives it or because there is nothing after it at all. These were always
  // left standing; they must stay that way, so closing the hole above is not
  // paid for by a reader that gives up whenever it sees an empty value.
  `[skill_check: skill="Stealth" dc="12" mode= dice="6d10" resolution="successes"]`,
  `[skill_check: skill="Stealth" dc="12" dice="6d10" mode=]`,
  `[skill_check: skill="Stealth" dc="12" mode="" dice="6d10"]`,
];
for (const poolTag of unvouchedPools) {
  const content = `He looms over the clerk. ${poolTag} The room waits.`;
  const outcome = await resolve(content, []);
  assert.equal(outcome.content, content, `a system the engine does not implement must survive verbatim: ${poolTag}`);
  assert.equal(outcome.resolved, 0, `nothing may be rewritten here: ${poolTag}`);
  assert.equal(outcome.consumed, 0, `no die may be thrown for a system the engine does not roll: ${poolTag}`);
  assert.equal(outcome.contextLoads, 0);

  // The client's legacy fallback is the other door onto the same rewrite: it
  // POSTs any tag with no resolvedResult, and the endpoint only rolls d20s.
  const clientTag = parseGmTags(poolTag).skillChecks[0]!;
  assert.equal(clientTag.resolvedResult, undefined, `precondition — the reader cannot vouch for this: ${poolTag}`);
  assert.equal(
    isEngineRollableSkillCheckTag(clientTag),
    false,
    `the client must not ask the endpoint to roll: ${poolTag}`,
  );
  assert.equal(clientTag.preRolledD20, undefined, "a pool die is never adopted as the player's own d20");
}

// …and the guard must not swallow the d20 shapes it exists to protect.
for (const [d20Tag, expectedDice] of [
  [`[skill_check: skill="Stealth" dc="15" dice="1d20"]`, 1],
  [`[skill_check: skill="Stealth" dc="15" dice="d20" resolution="sum"]`, 1],
  [`[skill_check: skill="Stealth" dc="15" dice="2d20" mode="advantage"]`, 2],
  // The two dice the engine labels itself, on the other mode.
  [`[skill_check: skill="Stealth" dc="15" dice="2d20" mode="disadvantage"]`, 2],
  // Spacing is not a rules declaration in either direction: a spaced d20 request
  // is still a d20 request, not a tag the reader gives up on.
  [`[skill_check: skill = "Stealth" dc = "15" dice = "1d20" resolution = "sum"]`, 1],
] as const) {
  const outcome = await resolve(d20Tag, [12, 6]);
  assert.equal(outcome.resolved, 1, `a d20 check must still be rolled by the engine: ${d20Tag}`);
  assert.equal(outcome.consumed, expectedDice, `the engine throws its own dice for: ${d20Tag}`);
}

// Advantage is a declaration, so only a declaration may set it. Reading the word
// out of the whole body read it out of the skill *name* too, and once the count
// rule above started holding the label and the mode to each other, that turned a
// plain d20 check into a two-die request over a one-die label — refused, and left
// unresolved for good with nothing in the turn to say why.
for (const [modeTag, wantAdvantage, wantDisadvantage, expectedDice, why] of [
  // The name is text, not a mode — in either spacing, either quote, and even when
  // the name is the bare word.
  [`[skill_check: skill="Press the advantage" dc="15" dice="1d20"]`, false, false, 1, "a skill name is not a mode"],
  [`[skill_check: skill="Fight at a disadvantage" dc="15" dice="1d20"]`, false, false, 1, "nor is this one"],
  [`[skill_check: skill = "Press the advantage" dc = "15"]`, false, false, 1, "spacing does not make it one"],
  [`[skill_check: skill='Press the advantage' dc="15"]`, false, false, 1, "neither does the quote style"],
  [`[skill_check: skill="Advantage" dc="15"]`, false, false, 1, "the whole name being the word changes nothing"],
  // What a declaration looks like, in every form the reader accepts. The bare
  // flag is the one the loose scan used to serve, and it must keep working.
  [`[skill_check: skill="Stealth" dc="15" mode="advantage"]`, true, false, 2, "mode= declares it"],
  [`[skill_check: skill="Stealth" dc="15" mode = advantage]`, true, false, 2, "spaced and unquoted, still mode="],
  [`[skill_check: skill="Stealth" dc="15" advantage]`, true, false, 2, "a bare flag is a declaration"],
  [`[skill_check: skill="Stealth" dc="15" disadvantage]`, false, true, 2, "and so is this one"],
  // `mode=` is compared lowercased, which the substring scan never managed: a
  // capitalised mode used to be read as no mode at all and quietly rolled one die.
  [`[skill_check: skill="Stealth" dc="15" mode="Advantage"]`, true, false, 2, "a capitalised mode still declares"],
  [`[skill_check: skill="Stealth" dc="15" mode="DISADVANTAGE"]`, false, true, 2, "in either direction"],
  // When the name and the declaration disagree, the declaration wins.
  [`[skill_check: skill="Seize the advantage" dc="15" mode="disadvantage"]`, false, true, 2, "mode= beats the name"],
] as const) {
  const tag = parseSkillCheckTagBody(modeTag.replace(/^\[skill_check:\s*|\]$/gu, ""))!;
  assert.equal(tag.advantage ?? false, wantAdvantage, `advantage is read from a declaration only — ${why}: ${modeTag}`);
  assert.equal(tag.disadvantage ?? false, wantDisadvantage, `disadvantage likewise — ${why}: ${modeTag}`);
  // The client reads the same tag through the same module, so the two sides
  // cannot disagree about whose turn it is to throw two dice.
  const clientTag = parseGmTags(modeTag).skillChecks[0]!;
  assert.equal(clientTag.advantage ?? false, wantAdvantage, `both readers agree on advantage: ${modeTag}`);
  assert.equal(clientTag.disadvantage ?? false, wantDisadvantage, `both readers agree on disadvantage: ${modeTag}`);

  const outcome = await resolve(modeTag, [4, 16]);
  assert.equal(outcome.resolved, 1, `a check the engine implements must not be left unresolved: ${modeTag}`);
  assert.equal(outcome.consumed, expectedDice, `${expectedDice} die/dice for ${why}: ${modeTag}`);
}

// Uniformly, not merely safely: the same request written with and without spaces
// around `=` must come out of the resolver as the same text, or the spacing is
// still deciding something.
const tightRequest = await resolve(`[skill_check: skill="Stealth" dc="15" dice="1d20"]`, [12]);
const spacedRequest = await resolve(`[skill_check: skill = "Stealth" dc = "15" dice = "1d20"]`, [12]);
assert.equal(spacedRequest.content, tightRequest.content, "spacing around = must not change what the engine writes");

// The server's other check reader has always scanned attributes loosely, so a
// tag both of them see is the only way the shared module's "one parse" claim
// holds. A spaced complete pool is prose to `stripGmCommandTags` and a trusted
// result to the shared reader, and they must agree on its numbers.
const spacedPool = `[skill_check: skill = "Intimidation" dc = "4" rolls = "3|7|9|2|10|5" modifier = "0" total = "3" result = "failure" mode = "normal" resolution = "successes" dice = "6d10"]`;
const spacedPoolTag = parseSkillCheckTagBody(spacedPool.replace(/^\[skill_check:\s*|\]$/gu, ""));
assert.ok(spacedPoolTag?.resolvedResult, "the shared reader must see the spaced pool the segment reader already sees");
assert.equal(spacedPoolTag.resolvedResult!.resolution, "successes");
assert.equal(spacedPoolTag.resolvedResult!.dice, "6d10");
assert.equal(
  stripGmCommandTags(spacedPool),
  `Skill check result: ${formatSkillCheckResultSummary(spacedPoolTag.resolvedResult!)}`,
  "both server readers must produce the same check from the same spaced tag",
);

// Text with no check tag at all is returned untouched, without a chat read.
const plain = await resolve("Nothing mechanical happens here.", []);
assert.equal(plain.content, "Nothing mechanical happens here.");
assert.equal(plain.contextLoads, 0);

// The counts account for every tag, so the debug line that reports them cannot
// quietly omit the pools and the out-of-bounds ones.
const mixedTurn = await resolve(
  [
    `[skill_check: skill="Stealth" dc="15"]`,
    honest,
    pool,
    `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10" resolution="successes" dice="6d10"]`,
    `[skill_check: skill="Stealth" dc="99"]`,
    `[skill_check: nonsense]`,
  ].join("\n\n"),
  [8],
);
assert.equal(mixedTurn.resolved, 1, "only the sparse d20 is rewritten");
assert.equal(mixedTurn.trusted, 2, "trusted still counts only tags whose own numbers held up");
assert.equal(mixedTurn.left, 5, "the unvouched pool, the out-of-bounds tag and the unreadable one count too");
assert.equal(mixedTurn.resolved + mixedTurn.left, 6, "resolved + left is every check tag in the turn");

// ── 4. Idempotent on re-entry ──
//
// What the resolver writes reads back as audited, so a second pass over the
// same content rolls nothing. Post-processing runs once per generation, but a
// continue rewrites a whole message body from text that already went through
// here, and a re-entry must not re-roll a settled check.

const secondPass = await resolve(sparse.content, []);
assert.equal(secondPass.content, sparse.content, "a second pass must change nothing");
assert.equal(secondPass.resolved, 0);
assert.equal(secondPass.trusted, 3);
assert.equal(secondPass.consumed, 0, "a settled check must not consume a die on re-entry");

// ── 5. What the GM wrote survives the roll ──

// A player's own [dice:1d20] echoed in rolls= is used, not thrown away and
// re-rolled — the sheet's modifiers still land on top of their number.
const preRolled = await resolve(`[skill_check: skill="Stealth" dc="15" rolls="17"]`, []);
assert.equal(preRolled.resolved, 1);
assert.equal(preRolled.consumed, 0, "the player already rolled; the engine must not roll again");
const preRolledTag = parseSkillCheckTagBody(tagBodies(preRolled.content)[0]!);
assert.equal(preRolledTag?.resolvedResult?.usedRoll, 17, "the player's die is the used die");
assert.equal(preRolledTag?.resolvedResult?.total, 21, "17 + Stealth's +4");

// Advantage declared on a sparse tag reaches the resolver, so two dice are
// thrown and the higher one counts.
const advantage = await resolve(`[skill_check: skill="Stealth" dc="15" mode="advantage"]`, [4, 16]);
assert.equal(advantage.consumed, 2, "advantage throws two dice");
const advantageTag = parseSkillCheckTagBody(tagBodies(advantage.content)[0]!);
assert.equal(advantageTag?.resolvedResult?.rollMode, "advantage");
assert.equal(advantageTag?.resolvedResult?.usedRoll, 16, "advantage takes the higher die");
assert.deepEqual(advantageTag?.resolvedResult?.rolls, [4, 16]);

// A DC outside the endpoint's own bounds is left in the prose rather than
// resolved by a path with looser rules than the one the client can reach.
const outOfBounds = await resolve(`[skill_check: skill="Stealth" dc="99"]`, []);
assert.equal(outOfBounds.resolved, 0);
assert.equal(outOfBounds.contextLoads, 0);
assert.match(outOfBounds.content, /dc="99"/u);

// ── 6. The legacy client fallback still works on old messages ──
//
// Messages saved before server-side resolution still carry sparse tags, and the
// client's own mutation path is what resolves those. It fires on a check with no
// resolvedResult, so the client reader must keep returning exactly that.

const legacySparse = parseGmTags(`[skill_check: skill="Stealth" dc="15" rolls="9"]`);
assert.equal(legacySparse.skillChecks.length, 1);
assert.equal(legacySparse.skillChecks[0]!.resolvedResult, undefined, "a sparse tag must still ask for a server roll");
assert.equal(legacySparse.skillChecks[0]!.preRolledD20, 9, "the player's echoed die still reaches the endpoint");
assert.equal(legacySparse.skillChecks[0]!.skill, "Stealth");
assert.equal(legacySparse.skillChecks[0]!.dc, 15);

const legacyResolved = parseGmTags(honest);
assert.ok(legacyResolved.skillChecks[0]?.resolvedResult, "a trusted tag must still render without a round trip");
assert.equal(legacyResolved.skillChecks[0]!.resolvedResult!.total, 17);

// Server and client read a check tag through the same module, so the fallback
// and the post-processing path can never disagree about who owes a roll.
const clientAudited = parseGmTags(invented).skillChecks[0]!;
assert.equal(clientAudited.resolvedResult, undefined, "the client audit rejects the same invented arithmetic");

// ── 7. The endpoint's rewrite no longer skips a tag for carrying result= ──

const gameRoutes = readFileSync(join(root, "packages/server/src/routes/game.routes.ts"), "utf8");
assert.ok(
  !gameRoutes.includes(String.raw`replaced || /\bresult\s*=/i.test(body)`),
  "the result= skip is the bug: a full tag that failed its audit was never rewritten",
);
assert.match(
  gameRoutes,
  /const tag = parseSkillCheckTagBody\(body\);\s*\n\s*if \(!tag \|\| tag\.resolvedResult\) return fullTag;/u,
  "the endpoint must decide replaceability with the shared audit, not an attribute grep",
);
assert.match(gameRoutes, /resolveChatSkillCheck\(app\.db, input\.chatId, \{/u, "the endpoint is a thin caller now");
assert.match(
  gameRoutes,
  /if \(!tag \|\| tag\.resolvedResult\) return fullTag;\s*\n\s*if \(!isEngineRollableSkillCheckTag\(tag\)\) return fullTag;/u,
  "the endpoint rewrite must refuse a system the engine does not roll, not only a tag whose numbers held",
);

// The client's fallback is the third door onto that same rewrite: it POSTs any
// tag with no resolvedResult, and this endpoint only ever rolls a d20.
const gameSurface = readFileSync(join(root, "packages/client/src/components/game/GameSurface.tsx"), "utf8");
assert.match(
  gameSurface,
  /isEngineRollableSkillCheckTag\(sc\)\s*\?\s*\(\s*await skillCheck\.mutateAsync\(/u,
  "the client must not ask the endpoint to roll a system the engine does not implement",
);

// ── 8. Resolution runs before the client is told what the turn says ──

const generateRoutes = readFileSync(join(root, "packages/server/src/routes/generate.routes.ts"), "utf8");
const resolutionAt = generateRoutes.indexOf("resolveSkillCheckTagsInContent(fullResponse");
const contentReplaceAt = generateRoutes.indexOf(`type: "content_replace", data: fullResponse`);
assert.ok(resolutionAt > 0, "generation post-processing must roll the GM's checks");
assert.ok(contentReplaceAt > 0);
assert.ok(
  resolutionAt < contentReplaceAt,
  "checks must be rolled before the content_replace frame, or the client renders numbers the save then changes",
);

// ── 9. The prompt asks for sparse checks and forbids invented numbers ──

const reminderContext = {
  gameActiveState: "exploration" as const,
  sessionNumber: 1,
  map: null,
  partyNames: [],
  playerName: "Player",
};

const reminder = buildGmFormatReminder(reminderContext);
assert.match(reminder, /\[skill_check: skill="Skill Name" dc="1-20"\]/u, "the advertised shape is sparse");
assert.match(reminder, /Do NOT invent rolls, modifier, total or result/u);
assert.match(reminder, /the engine supplies the die and character-sheet modifiers/u);
assert.match(reminder, /finish this same turn/u, "the outcome continuation is stated, not implied");
assert.doesNotMatch(reminder, /total="roll \+ modifier"/u, "the GM must no longer be shown a total to fill in");
assert.doesNotMatch(reminder, /rolls="1-20"/u, "the GM must no longer be shown a die to fill in");

const preRollReminder = buildGmFormatReminder({ ...reminderContext, playerDiceRollSubmitted: true });
assert.match(
  preRollReminder,
  /\[skill_check: skill="Skill Name" dc="1-20" rolls="the player's d20 result"\]/u,
  "when the player rolled, the GM passes their number through and nothing else",
);
assert.match(preRollReminder, /Do NOT write modifier, total or result/u);
assert.match(preRollReminder, /finish this same turn/u);
assert.doesNotMatch(preRollReminder, /total="roll \+ modifier"/u);

// Pool requests state their rules rather than supplying invented results.
const POOL_EXAMPLE_TAG = `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]`;
for (const text of [reminder, preRollReminder]) {
  assert.ok(text.includes(POOL_EXAMPLE_TAG), "the GM is shown a pool with an explicit per-die threshold");
  assert.match(text, /Never invent pool results or omit its threshold/u);
  assert.match(text, /\[dice: 3d8\+2\]/u, "ordinary dice requests also work without tools");
}
const poolExampleTag = parseSkillCheckTagBody(POOL_EXAMPLE_TAG.replace(/^\[skill_check:\s*|\]$/gu, ""));
assert.equal(poolExampleTag?.resolvedResult, undefined, "the advertised pool requests numbers from the engine");

// ── 10. The serializer round-trips, so the two halves cannot drift ──

const roundTripped = parseSkillCheckTagBody(
  serializeResolvedSkillCheckTag({
    skill: "Athletics",
    dc: 14,
    rolls: [13],
    usedRoll: 13,
    modifier: 2,
    total: 15,
    success: true,
    criticalSuccess: false,
    criticalFailure: false,
    rollMode: "normal",
    resolution: "sum",
    dice: "1d20",
  }).replace(/^\[skill_check:\s*|\]$/gu, ""),
);
assert.ok(roundTripped?.resolvedResult, "what the resolver writes must read back as audited, or nothing is idempotent");
assert.equal(roundTripped.resolvedResult!.total, 15);

// ── 11. A tag declaring BOTH modes is a system the engine does not have ──
//
// The roller cancels the pair — `advantage && !disadvantage` on one side,
// `disadvantage && !advantage` on the other — so a contradictory tag is rolled as
// a plain, single-die, normal check. The rollable guard, meanwhile, read the pair
// as "two dice wanted" and let it through, so `dice="2d20" mode="advantage"
// disadvantage` was accepted, thrown once, and written back `dice="1d20"
// mode="normal"`: the GM's own declaration rewritten in the text about to be
// saved, which is the exact move refusing a pool exists to prevent.
for (const contradiction of [
  `[skill_check: skill="Stealth" dc="15" mode="advantage" disadvantage]`,
  `[skill_check: skill="Stealth" dc="15" advantage disadvantage]`,
  `[skill_check: skill="Stealth" dc="15" mode="disadvantage" advantage]`,
  // The sharp one: a label the count rule would otherwise have blessed.
  `[skill_check: skill="Stealth" dc="15" dice="2d20" mode="advantage" disadvantage]`,
]) {
  const tag = parseSkillCheckTagBody(contradiction.replace(/^\[skill_check:\s*|\]$/gu, ""))!;
  assert.equal(tag.advantage, true, `precondition — both modes are read: ${contradiction}`);
  assert.equal(tag.disadvantage, true, `precondition — both modes are read: ${contradiction}`);
  assert.equal(
    isEngineRollableSkillCheckTag(tag),
    false,
    `a check declaring both modes names no system the engine has: ${contradiction}`,
  );

  const outcome = await resolve(`She hesitates. ${contradiction} The door gives.`, []);
  assert.equal(outcome.content, `She hesitates. ${contradiction} The door gives.`, "the tag is left as written");
  assert.equal(outcome.resolved, 0, `nothing may be rewritten here: ${contradiction}`);
  assert.equal(outcome.consumed, 0, `no die may be thrown for it either: ${contradiction}`);
  assert.equal(outcome.contextLoads, 0);

  // The client's fallback is the other door onto the same roll, and it must
  // refuse the tag for the same reason rather than POST it to the endpoint.
  const clientTag = parseGmTags(contradiction).skillChecks[0]!;
  assert.equal(isEngineRollableSkillCheckTag(clientTag), false, `nor may the client ask for it: ${contradiction}`);
}

// One mode on its own is untouched by that rule — the guard must refuse the
// contradiction, not the modes.
for (const single of [
  `[skill_check: skill="Stealth" dc="15" mode="advantage"]`,
  `[skill_check: skill="Stealth" dc="15" mode="disadvantage"]`,
  `[skill_check: skill="Stealth" dc="15" advantage]`,
]) {
  assert.equal((await resolve(single, [4, 16])).consumed, 2, `one declared mode still throws two dice: ${single}`);
}

// ── 12. A roll that cannot happen saves the ask, never the invention ──
//
// This is the error path's half of section 2. When the chat's modifiers will not
// load, the turn still has to be saved, and saving it unchanged means saving the
// model's `rolls="7" total="19" result="success"` on a check nobody rolled — read
// back next turn as fact, which is the whole dishonesty the engine took the die
// away to end. Arriving at it through the catch instead of the happy path does
// not make it a different outcome.

const failingTurn = [
  invented,
  `You reach for the latch. [skill_check: skill="Stealth" dc="15" mode="advantage"]`,
  `The clerk flinches. ${pool}`,
  honest,
].join("\n\n");

let failedLoads = 0;
const failed = await resolveSkillCheckTagsInContent(failingTurn, {
  loadContext: async () => {
    failedLoads += 1;
    throw new Error("game state store is down");
  },
  rollD20: () => {
    throw new Error("no die may be thrown when the modifiers are unknown");
  },
  chatId: "chat-regression",
});

assert.equal(failedLoads, 1, "precondition — the modifier read is what failed");
assert.equal(failed.resolved, 0, "nothing was rolled, so nothing may claim to have been");
assert.equal(failed.sparse, 2, "both tags that owed a roll go back sparse");
assert.equal(failed.trusted, 2, "the honest check and the complete pool still hold their own numbers");
assert.equal(failed.left, 4, "every tag is accounted for — resolved + left is all four");
// The invention is gone. Not corrected, not re-rolled — gone, with nothing put in
// its place, because the engine has no number to put there. Read off the stripped
// tag itself rather than the whole turn: the honest check further down carries a
// `result="success"` it is fully entitled to.
const strippedBody = tagBodies(failed.content)[0]!;
assert.doesNotMatch(strippedBody, /total=/u, "the invented total must not be saved by the error path either");
assert.doesNotMatch(strippedBody, /rolls=/u, "nor the invented die");
assert.doesNotMatch(strippedBody, /result=/u, "nor the invented outcome");
assert.doesNotMatch(strippedBody, /modifier=/u, "nor a modifier nobody applied");
assert.doesNotMatch(failed.content, /total="19"/u, "and the invented numbers are gone from the turn entirely");
assert.doesNotMatch(failed.content, /rolls="7"/u);
// The prose and the systems the engine never touches survive it.
assert.match(failed.content, /The guard turns\./u);
assert.match(failed.content, /He does not see you\./u);
assert.ok(failed.content.includes(pool), "a pool the engine does not roll is not the error path's business");
assert.ok(failed.content.includes(honest), "and neither is a check whose own numbers held up");

// What is written back is the ask, and it reads back as one: same skill, same DC,
// same mode, still owing a roll, still something the client's fallback may ask
// the endpoint for. Nothing was invented to fill the gap.
const sparseBodies = tagBodies(failed.content).map((body) => parseSkillCheckTagBody(body)!);
assert.equal(sparseBodies.length, 4);
assert.equal(sparseBodies[0]!.resolvedResult, undefined, "the stripped tag still owes a roll");
assert.equal(sparseBodies[0]!.skill, "Perception");
assert.equal(sparseBodies[0]!.dc, 12);
assert.equal(isEngineRollableSkillCheckTag(sparseBodies[0]!), true, "and the client may still ask for it");
assert.equal(sparseBodies[1]!.resolvedResult, undefined);
assert.equal(sparseBodies[1]!.skill, "Stealth");
assert.equal(sparseBodies[1]!.dc, 15);
assert.equal(sparseBodies[1]!.advantage, true, "the mode the GM declared survives the strip");
assert.equal(
  parseGmTags(failed.content).skillChecks[0]!.resolvedResult,
  undefined,
  "both readers agree it is unrolled",
);

// The turn completes: a later pass over the saved text rolls the checks that were
// owed, so the strip costs the check its numbers for one turn and costs the turn
// nothing at all.
const recovered = await resolve(failed.content, [11, 4, 16]);
assert.equal(recovered.resolved, 2, "the sparse tags are rollable again the moment the modifiers load");
assert.equal(recovered.consumed, 3, "one die for the plain check, two for the advantage one");

// A turn with nothing owed cannot be harmed by a failure it never reaches.
let untouchedLoads = 0;
const untouched = await resolveSkillCheckTagsInContent(`${honest}\n\n${pool}`, {
  loadContext: async () => {
    untouchedLoads += 1;
    throw new Error("game state store is down");
  },
  chatId: "chat-regression",
});
assert.equal(untouchedLoads, 0, "a turn with nothing to roll never reads the chat, so it never fails");
assert.equal(untouched.content, `${honest}\n\n${pool}`);
assert.equal(untouched.sparse, 0);

// The route follows the CONTENT, not the roll count, or the honest sparse text is
// computed and then thrown away — and it must not wrap the call in a catch that
// saves `fullResponse` as the model wrote it, which is the invention arriving
// through the error door.
assert.match(
  generateRoutes,
  /const rolled = await resolveSkillCheckTagsInContent\(fullResponse, \{[\s\S]*?\}\);\s*const generalRolls = resolveGameDiceRequests\(rolled\.content, toolDiceRollResults\);\s*if \(generalRolls\.content !== fullResponse\) \{/u,
  "the resolver's own output decides the frame and the save on both paths",
);

// ── 13. The tag reader does not slow down on a long run of word characters ──
//
// CodeQL's polynomial-ReDoS alert (code-scanning/500). The attribute grammar was
// `(\w+)\s*=\s*(…)`, and a key match can begin at ANY offset inside a word, so a
// body of repeated `0`s made the engine scan to the end of the run once per
// character. Measured on this machine before the rewrite: 32,000 zeros took just
// over two seconds, and the `0…0=0…0=` shape below took nearly five. The bound is
// deliberately coarse — three orders of magnitude above the ~1ms the scan costs
// now — so it fails on the quadratic shape and never on a slow CI box.
const ZEROS = "0".repeat(24_000); // 24k keeps the quadratic/linear separation unambiguous at a fifth of the red-path cost
const adversarialBodies = [
  // No `=` at all: every offset in the run was a fresh doomed key match.
  ZEROS,
  // A readable check with the run trailing it — the shape a GM could actually emit.
  `skill="Stealth" dc="15" note=${ZEROS}`,
  // The negative lookahead's own shape: `\w+\s*=` re-scanned the next run too.
  `${ZEROS}=${ZEROS}=`,
];
const scanStart = performance.now();
const adversarialTags = adversarialBodies.map((body) => parseSkillCheckTagBody(body));
const scanMs = performance.now() - scanStart;
assert.ok(scanMs < 1000, `reading ${adversarialBodies.length} adversarial bodies must stay linear (took ${scanMs}ms)`);

// Fast is only half of it — the reader must still say the same things it said.
assert.equal(adversarialTags[0], null, "a body with no attributes at all is not a check");
assert.equal(adversarialTags[1]?.skill, "Stealth", "a real check followed by garbage is still that check");
assert.equal(adversarialTags[1]?.dc, 15);
assert.equal(adversarialTags[1]?.resolvedResult, undefined, "and it still owes a roll");
assert.equal(adversarialTags[2], null, "neither is a run of digits with equals signs in it");

// ── 14. The player's card is found by identity, not by position ──
//
// `gameCharacterCards[0]` was "the player". That is a convention the setup prompt
// follows — it lists the player's name first — not a fact the array keeps: a
// recruit appends, a removal splices, and a session-conclusion rewrite re-emits
// the array in whatever order it read the cards back in. The moment the player
// stops being first, every check in the campaign scores against a PARTY MEMBER's
// sheet, and a wrong DEX changes whether the player got past the guard with
// nothing in the turn to say so.
const createdChatIds: string[] = [];
try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const characters = createCharactersStorage(db);

  const persona = await characters.createPersona("Bex Marrow", "The player character.");
  assert.ok(persona?.id, "precondition — the chat needs a persona to be identified by");

  const partyOf = (cards: Array<[string, number]>) =>
    cards.map(([name, dex]) => ({ name, rpgStats: { attributes: [{ name: "DEX", value: dex }] } }));

  const newGameChat = async (name: string, personaId: string | null, cards: Array<[string, number]>) => {
    const chat = await chats.create({
      name,
      mode: "game",
      characterIds: [],
      ...(personaId ? { personaId } : {}),
    } as Parameters<typeof chats.create>[0]);
    assert.ok(chat?.id);
    createdChatIds.push(chat.id);
    await chats.patchMetadata(chat.id, { gameCharacterCards: partyOf(cards) });
    return chat.id;
  };

  // The party as recruiting leaves it: the player is LAST, behind two members
  // whose Dexterity is deliberately the opposite of theirs.
  const recruitedChatId = await newGameChat("skill check identity", persona.id, [
    ["Kade", 6],
    ["Tam", 8],
    ["Bex Marrow", 18],
  ]);
  const identity = await loadSkillCheckModifierContext(db, recruitedChatId);
  assert.equal(identity.sheetAttributes.dex, 18, "the player's own sheet, not whichever card sits first");

  // …and it reaches the die, which is the part a player would actually notice.
  const identityRoll = await resolve(`[skill_check: skill="Stealth" dc="15"]`, [10], identity);
  const identityTag = parseSkillCheckTagBody(tagBodies(identityRoll.content)[0]!);
  assert.equal(identityTag?.resolvedResult?.modifier, 4, "DEX 18 is +4; the first card's DEX 6 would have been -2");
  assert.equal(identityTag?.resolvedResult?.total, 14, "10 + 4");
  assert.equal(identityTag?.resolvedResult?.success, false, "14 misses DC 15 — which the wrong sheet would not have");

  // Matching is by name the way every other card lookup in Game Mode matches:
  // normalized, so case and punctuation are not identity either.
  const punctuatedChatId = await newGameChat("skill check identity punctuation", persona.id, [
    ["Kade", 6],
    ["bex  marrow", 18],
  ]);
  assert.equal(
    (await loadSkillCheckModifierContext(db, punctuatedChatId)).sheetAttributes.dex,
    18,
    "the same name spelled loosely is still the same player",
  );

  // The two chats that give this nothing to match on keep the behavior they had.
  // A game with no persona has no identity to look up…
  const anonymousChatId = await newGameChat("skill check identity anonymous", null, [
    ["Kade", 6],
    ["Bex Marrow", 18],
  ]);
  assert.equal(
    (await loadSkillCheckModifierContext(db, anonymousChatId)).sheetAttributes.dex,
    6,
    "with no persona to match, the first card is still the answer it always was",
  );
  // …and neither does a game whose cards never included one for the player.
  const uncardedChatId = await newGameChat("skill check identity uncarded", persona.id, [
    ["Kade", 6],
    ["Tam", 8],
  ]);
  assert.equal(
    (await loadSkillCheckModifierContext(db, uncardedChatId)).sheetAttributes.dex,
    6,
    "a player with no card of their own falls back to the first card, unchanged",
  );

  console.log("gm-skill-check-resolution regression passed");
} finally {
  const db = await getDB().catch(() => null);
  if (db) {
    const chats = createChatsStorage(db);
    for (const chatId of createdChatIds) await chats.remove(chatId).catch(() => undefined);
  }
  await closeDB().catch(() => undefined);
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  if (previousMarinaraFileStorageDir === undefined) delete process.env.MARINARA_FILE_STORAGE_DIR;
  else process.env.MARINARA_FILE_STORAGE_DIR = previousMarinaraFileStorageDir;
}
