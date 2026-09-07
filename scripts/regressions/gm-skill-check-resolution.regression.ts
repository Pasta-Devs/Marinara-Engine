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
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  formatSkillCheckResultSummary,
  isEngineRollableSkillCheckTag,
  parseSkillCheckTagBody,
  serializeResolvedSkillCheckTag,
} from "../../packages/shared/dist/index.js";
import {
  resolveSkillCheckTagsInContent,
  type SkillCheckModifierContext,
} from "../../packages/server/src/services/game/skill-check-resolution.service.js";
import { stripGmCommandTags } from "../../packages/server/src/services/game/segment-edits.js";
import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import { parseGmTags } from "../../packages/client/src/lib/game-tag-parser.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

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
assert.equal(overwrittenTag?.resolvedResult?.success, false, "11 misses DC 12 — the honest outcome, not the claimed one");
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
  assert.equal(isEngineRollableSkillCheckTag(clientTag), false, `the client must not ask the endpoint to roll: ${poolTag}`);
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
  /\} else if \(isEngineRollableSkillCheckTag\(sc\)\) \{\s*\n\s*skillCheck\.mutate\(/u,
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
assert.match(reminder, /the engine rolls the die and fills them in/u);
assert.match(reminder, /the consequence belongs to your next turn/u, "the two-beat convention is stated, not implied");
assert.doesNotMatch(reminder, /total="roll \+ modifier"/u, "the GM must no longer be shown a total to fill in");
assert.doesNotMatch(reminder, /rolls="1-20"/u, "the GM must no longer be shown a die to fill in");

const preRollReminder = buildGmFormatReminder({ ...reminderContext, playerDiceRollSubmitted: true });
assert.match(
  preRollReminder,
  /\[skill_check: skill="Skill Name" dc="1-20" rolls="the player's d20 result"\]/u,
  "when the player rolled, the GM passes their number through and nothing else",
);
assert.match(preRollReminder, /Do NOT write modifier, total or result/u);
assert.match(preRollReminder, /the consequence belongs to your next turn/u);
assert.doesNotMatch(preRollReminder, /total="roll \+ modifier"/u);

// Pool systems still need the full form, because the engine cannot resolve them
// — and the sparse convention removed the full form from every other template
// in the file, so this clause is the only place the GM is shown one. Telling it
// to "write the full tag yourself" without showing the tag is how a pool arrives
// missing modifier= or result=, which is exactly the shape left unresolved.
const POOL_EXAMPLE_TAG = `[skill_check: skill="Intimidation" dc="4" rolls="3|7|9|2|10|5" modifier="0" total="3" result="failure" resolution="successes" dice="6d10"]`;
for (const text of [reminder, preRollReminder]) {
  assert.match(text, /dice="6d10"/u, "pool guidance survives the convention change");
  assert.match(text, /resolution="successes"/u);
  assert.ok(text.includes(POOL_EXAMPLE_TAG), "the GM must be shown the full tag it is told to write");
}

// The example is not decoration: the shape the GM is shown has to be one the
// shared reader audits as complete, or the prompt teaches a tag the engine
// leaves unresolved.
const poolExampleTag = parseSkillCheckTagBody(POOL_EXAMPLE_TAG.replace(/^\[skill_check:\s*|\]$/gu, ""));
assert.ok(poolExampleTag?.resolvedResult, "the advertised pool tag must read back as a complete, trusted pool");
assert.equal(poolExampleTag.resolvedResult!.resolution, "successes");
assert.equal(poolExampleTag.resolvedResult!.dice, "6d10");
assert.deepEqual(poolExampleTag.resolvedResult!.rolls, [3, 7, 9, 2, 10, 5]);
assert.equal(
  (await resolve(POOL_EXAMPLE_TAG, [])).content,
  POOL_EXAMPLE_TAG,
  "and the engine must leave the tag it advertises exactly as written",
);

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

console.log("gm-skill-check-resolution regression passed");
