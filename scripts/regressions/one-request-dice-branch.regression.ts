// ──────────────────────────────────────────────
// One-request dice: the branch block.
//
// The Game Master writes both outcomes of a binary check without seeing any number, and
// the engine keeps the half the real roll selects. Four things have to hold at once, and
// each one is a section below.
//
//   1. THE HALF THE DIE SELECTED IS KEPT AND THE OTHER IS GONE, criticals folded into
//      their own half by the `success` boolean rather than branching a third way.
//   2. A BLOCK THE ENGINE CANNOT READ LOSES BOTH HALVES AND KEEPS THE ASK. Keeping one
//      half without a roll invents the outcome; keeping both saves a turn asserting two
//      contradictory things; losing the check tag loses the question the GM asked.
//   3. NO DELIMITER REACHES SAVED CONTENT, on either side's stripper. Three of the four
//      are unreachable by every name set on both sides, so the pin below also shows that
//      set membership alone cannot be the fix.
//   4. A COMMAND INSIDE THE DISCARDED HALF NEVER REACHES A PARSER. That is the whole
//      reason the arm runs where it does, and it is asserted against the real route
//      rather than against the helper, because the ordering is the claim.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { AssistantSpatialDirective } from "../../packages/server/src/services/spatial-context/state-resolution.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-dice-branch-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

// ── A real declared verb table, so the ordering proof observes a real package write ──
const packagesRoot = join(dir, "capability-packages");
const versionRoot = join(packagesRoot, "versions", "pixelforge", "1.0.0");
mkdirSync(versionRoot, { recursive: true });
const table = JSON.stringify({
  schemaVersion: 1,
  verbs: [
    {
      name: "weather",
      description: "Set the weather.",
      effect: "state",
      metadataKey: "pixelforgeWeather",
      args: [{ name: "word", type: "string", enum: ["fair", "rain", "storm"] }],
    },
  ],
});
const files = [
  { path: "gm-verbs.json", content: table },
  { path: "client.js", content: "x" },
];
for (const file of files) writeFileSync(join(versionRoot, file.path), file.content);
writeFileSync(
  join(packagesRoot, "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: "pixelforge",
        version: "1.0.0",
        installedAt: "2026-09-13T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
        manifest: {
          schemaVersion: 2,
          capabilityApi: { major: 1, minor: 10 },
          builtAgainst: { engineVersion: "2.4.5", engineCommit: "0".repeat(40) },
          id: "pixelforge",
          name: "Branch fixture",
          version: "1.0.0",
          description: "One-request dice branch regression.",
          engine: { min: "2.3.0", maxExclusive: "3.0.0" },
          kind: ["turn-game"],
          entrypoints: { client: "client.js" },
          contributions: { assets: { paths: ["gm-verbs.json"] } },
          files: files.map(({ path, content }) => ({
            path,
            sha256: createHash("sha256").update(content).digest("hex"),
            bytes: Buffer.byteLength(content),
          })),
          permissions: ["chat-write"],
          restartRequired: false,
        },
      },
    ],
  }),
);

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { registerCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { resolveGmVerbTable } =
  await import("../../packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const { createGameTurnChanceSession, resolveGameTurnBranches, runGameTurnChancePass, summarizeGameDiceTurn } =
  await import("../../packages/server/src/services/game/one-request-dice.js");
const { stripGmCommandTags } = await import("../../packages/server/src/services/game/segment-edits.js");
const {
  dropGameBranchBlocks,
  readSkillCheckBranchLabel,
  scanGameBranchBlocks,
  selectGameBranchHalf,
  stripGameBranchDelimiters,
} = await import("../../packages/shared/dist/index.js");
const { stripGmTags, stripGmTagsKeepReadables } = await import("../../packages/client/src/lib/game-tag-parser.js");

// ══ 1. The grammar, scanned rather than matched ══════════════════════════════

const wellFormed = [
  'He edges along the wall. [skill_check: skill="Stealth" dc="10" branch="crates"]',
  "[branch: crates]",
  "[on success] The guard's gaze slides past.",
  "[on failure] A boot scuffs stone.",
  "[/branch]",
  "The corridor waits.",
].join("\n");

const scanned = scanGameBranchBlocks(wellFormed);
assert.equal(scanned.length, 1);
assert.equal(scanned[0]!.refusal, null, "a well-formed block is readable");
assert.equal(scanned[0]!.label, "crates");
assert.deepEqual(
  scanned[0]!.halves.map((half) => half.outcome),
  ["success", "failure"],
);
assert.equal(scanned[0]!.halves[0]!.text, "The guard's gaze slides past.");
assert.equal(selectGameBranchHalf(scanned[0]!, true)?.text, "The guard's gaze slides past.");
assert.equal(selectGameBranchHalf(scanned[0]!, false)?.text, "A boot scuffs stone.");
assert.equal(
  readSkillCheckBranchLabel('skill="Stealth" dc="10" branch="Crates"'),
  "crates",
  "the label folds on both sides, so one spelling cannot miss the other",
);
assert.equal(
  readSkillCheckBranchLabel('skill="Leap the branch" dc="10"'),
  null,
  "a label is read through the audited attribute walk, never out of a skill name",
);

// Every malformed shape the contract owns is FOUND, because a block that is never found
// is a block whose delimiters reach saved content with both halves standing as prose.
const malformed: Array<[string, string]> = [
  ["[branch: a]\n[on success] Up.\n[/branch]", "missing-half"],
  ["[branch: a]\n[on success] Up.\n[on success] Also up.\n[/branch]", "duplicate-half"],
  ["[branch: a]\n[on success]\n[on failure] Down.\n[/branch]", "missing-half"],
  ["[branch: ]\n[on success] Up.\n[on failure] Down.\n[/branch]", "empty-label"],
  ["[branch: a]\n[on success] Up.\n[branch: b]\n[on failure] Down.\n[/branch]", "nested"],
  ['[branch: a]\n[on success] Up. [skill_check: skill="Stealth" dc="10"]\n[on failure] Down.\n[/branch]', "nested"],
  ["[branch: a]\n[on success] Up.\n[on failure] Down.", "unterminated"],
];
for (const [raw, reason] of malformed) {
  const blocks = scanGameBranchBlocks(raw);
  assert.equal(blocks.length, 1, raw);
  assert.equal(blocks[0]!.refusal, reason, raw);
  assert.equal(selectGameBranchHalf(blocks[0]!, true), null, "a refused block selects no half");
}

// An unterminated block that never wrote a half marker is the opener alone. Bounding it
// to the end of the content would let a stray `[branch:` in ordinary prose eat the turn.
// A turn made of nothing but openers that never close. With an unbounded label class the
// opener pattern re-scanned to the end of the turn from every one of them, which is
// quadratic; the bounded label keeps both the scan and the display strip linear. None of
// them is an opener, because none of them closes, so the text is left exactly as it came.
{
  const wall = "[branch:".repeat(60_000);
  const started = performance.now();
  assert.deepEqual(scanGameBranchBlocks(wall), [], "an opener that never closes is not a block");
  assert.equal(stripGameBranchDelimiters(wall), wall, "and the strip leaves it alone");
  assert.ok(performance.now() - started < 5_000, "in linear time");
  // The same wall built of REAL openers, none of which closes or writes a half marker.
  // Every one is a refused block, and the scan must not search the whole suffix for a
  // closer and then a half marker from each of them: it remembers that nothing lies ahead.
  const openerWall = "[branch:x]".repeat(60_000);
  const openersStarted = performance.now();
  const refused = scanGameBranchBlocks(openerWall);
  assert.ok(performance.now() - openersStarted < 5_000, "a wall of real openers is scanned in linear time");
  assert.equal(refused.length, 60_000, "every opener is a block of its own");
  assert.ok(refused.every((block) => block.refusal === "unterminated"));
  // The bound itself: a label at it is read, one past it is not an opener at all. The
  // unknown-tag catch-alls on both sides still take such a tag out of the player's view.
  assert.equal(scanGameBranchBlocks(`[branch: ${"x".repeat(79)}]`).length, 1, "a label at the bound is read");
  assert.equal(scanGameBranchBlocks(`[branch: ${"x".repeat(80)}]`).length, 0, "past it the opener is not one");
}

const stray = scanGameBranchBlocks("He turns. [branch: nothing] The corridor waits.");
assert.equal(stray.length, 1);
assert.equal(stray[0]!.raw, "[branch: nothing]", "a stray opener bounds at itself");
const strayDropped = dropGameBranchBlocks("He turns. [branch: nothing] The corridor waits.");
assert.equal(strayDropped.content, "He turns.  The corridor waits.", "and no prose is lost with it");

// The failure sweep drops blocks whole and keeps the ask.
const swept = dropGameBranchBlocks(
  '[branch: a]\n[on success] Up. [skill_check: skill="Stealth" dc="10"]\n[on failure] Down.\n[/branch]',
);
assert.equal(swept.changed, true);
assert.doesNotMatch(swept.content, /Up\.|Down\./, "neither half survives a sweep that rolled nothing");
assert.match(swept.content, /\[skill_check: skill="Stealth" dc="10"\]/, "the ask inside the block survives");
assert.doesNotMatch(swept.content, /\[branch:|\[on\s|\[\/branch\]/i, swept.content);

// A lowercase that changes LENGTH must not move the closer. `İ` (U+0130) lowercases to
// two code units, so a closer offset taken from a lowercased copy and applied back to the
// original content drifts one character per `İ`: the block would end past its own
// `[/branch]`, eat that many characters of the narration after it, and leave a `[/`
// fragment inside the last half for no stripper to match.
const turkishBlock = [
  "[branch: x]",
  "[on success] İstanbul yolu açık.",
  "[on failure] İzmir yolu kapalı.",
  "[/branch] TAIL-PROSE-MUST-SURVIVE",
].join("\n");
const turkishScanned = scanGameBranchBlocks(turkishBlock);
assert.equal(turkishScanned.length, 1);
assert.equal(turkishScanned[0]!.refusal, null, "a Turkish block is as readable as its ASCII twin");
assert.ok(turkishScanned[0]!.raw.endsWith("[/branch]"), `the block ended past its closer: ${turkishScanned[0]!.raw}`);
assert.equal(turkishScanned[0]!.halves[1]!.text, "İzmir yolu kapalı.", "and no half keeps a closer fragment");
assert.equal(
  dropGameBranchBlocks(turkishBlock).content,
  " TAIL-PROSE-MUST-SURVIVE",
  "every character after the closer survives the sweep",
);

// ══ 2. The arm: the die selects, and a refusal keeps neither half ════════════

interface LaneSession {
  session: ReturnType<typeof createGameTurnChanceSession>;
  sheetReads: () => number;
}

/** One session with a scripted d20, so a natural 20 and a natural 1 are reachable. */
function laneSession(faces: number[]): LaneSession {
  const queue = [...faces];
  let sheetReads = 0;
  const session = createGameTurnChanceSession({
    db: null as never,
    chatId: "lane",
    roll: (sides) => {
      assert.equal(sides, 20, "a branch check throws the engine's d20 and nothing else");
      const face = queue.shift();
      assert.ok(face !== undefined, "the lane ran out of scripted faces");
      return face;
    },
    loadModifierContext: () => {
      sheetReads += 1;
      return Promise.resolve({ skills: null, attributes: null, sheetAttributes: {} });
    },
  });
  return { session, sheetReads: () => sheetReads };
}

function block(label: string, dc: string, success: string, failure: string): string {
  return [
    `Before. [skill_check: skill="Stealth" dc="${dc}" branch="${label}"]`,
    `[branch: ${label}]`,
    `[on success] ${success}`,
    `[on failure] ${failure}`,
    "[/branch]",
    "After.",
  ].join("\n");
}

const kept: Array<[string, number, string, string, string]> = [
  // dc, face, the outcome the record must carry, the half kept, the half gone
  ["10", 15, "success", "Past him.", "He turns."],
  ["10", 3, "failure", "He turns.", "Past him."],
  // A critical folds into its own half by the `success` boolean. It never branches a
  // third way, and the record still says which critical it was.
  ["40", 20, "critical_success", "Past him.", "He turns."],
  ["1", 1, "critical_failure", "He turns.", "Past him."],
];
for (const [dc, face, outcome, keptHalf, goneHalf] of kept) {
  const lane = laneSession([face]);
  const rewrite = await resolveGameTurnBranches(block("crates", dc, "Past him.", "He turns."), lane.session);
  assert.equal(rewrite.changed, true, `${dc}/${face}`);
  assert.ok(rewrite.content.includes(keptHalf), `${outcome}: the selected half is kept — ${rewrite.content}`);
  assert.ok(!rewrite.content.includes(goneHalf), `${outcome}: the other half is gone — ${rewrite.content}`);
  assert.match(rewrite.content, new RegExp(`result="${outcome}"`), rewrite.content);
  assert.match(rewrite.content, new RegExp(`rolls="${face}"`), "the record names the die the engine threw");
  assert.doesNotMatch(rewrite.content, /\[branch:|\[on\s|\[\/branch\]/i, rewrite.content);
  assert.ok(rewrite.content.startsWith("Before. ") && rewrite.content.endsWith("After."), rewrite.content);
  assert.equal(lane.sheetReads(), 1, "one sheet read per turn, not one per check");
  const notice = summarizeGameDiceTurn(lane.session);
  assert.deepEqual(notice?.forms, ["branch"]);
  assert.equal(notice?.branchFailures, undefined, "a resolved block is not a failure");

  // Idempotent: nothing is left for a second pass to find, so a continuation or a
  // re-entry cannot roll the same declared check twice.
  const again = await resolveGameTurnBranches(rewrite.content, laneSession([]).session);
  assert.equal(again.changed, false, "a resolved turn carries no block for a second pass");
}

// Every refusal: neither half kept, the delimiters gone, and the check still answered.
const refusals: Array<[string, string, boolean]> = [
  // draft, label of the assertion, whether the arm itself rolls the matched check
  [block("crates", "10", "Past him.", "He turns.").replace("[on failure] He turns.\n", ""), "missing half", true],
  [block("crates", "10", "Past him.", "He turns.").replace("[branch: crates]", "[branch: cellar]"), "unmatched", false],
  [
    block("crates", "10", "Past him.", "He turns.").replace("[on failure]", "[branch: inner]\n[on failure]"),
    "nested",
    true,
  ],
  [block("crates", "10", "Past him.", "He turns.").replace("[branch: crates]", "[branch: ]"), "empty label", false],
];
for (const [draft, name, rolls] of refusals) {
  const lane = laneSession(rolls ? [15] : []);
  const rewrite = await resolveGameTurnBranches(draft, lane.session);
  assert.equal(rewrite.changed, true, name);
  assert.ok(!rewrite.content.includes("Past him."), `${name}: the success half is not kept — ${rewrite.content}`);
  assert.ok(!rewrite.content.includes("He turns."), `${name}: the failure half is not kept — ${rewrite.content}`);
  assert.doesNotMatch(rewrite.content, /\[branch:|\[on\s|\[\/branch\]/i, `${name}: ${rewrite.content}`);
  assert.match(rewrite.content, /\[skill_check:/, `${name}: the ask survives every refusal`);
  if (rolls) {
    // A refused block still gets its check rolled and RECORDED, never left sparse: a
    // sparse engine-rollable tag in saved content is what the client's own fallback
    // picks up and rolls again, so one declared check would produce two rolls.
    assert.match(rewrite.content, /result="success"/, `${name}: the roll stands`);
    assert.doesNotMatch(rewrite.content, /branch="/, `${name}: the resolved record drops the label`);
  } else {
    assert.match(rewrite.content, /branch="crates"/, `${name}: an unmatched tag is left for the shipped resolver`);
    assert.doesNotMatch(rewrite.content, /result="/, `${name}: the arm rolls nothing it did not match`);
  }
  const notice = summarizeGameDiceTurn(lane.session);
  assert.equal(notice?.branchFailures, 1, `${name}: the turn notice reports the failure`);
  assert.equal(notice?.forms, undefined, `${name}: a refused block is not a form that resolved`);
}

// A label claimed twice decides nothing, so it matches nothing and rolls nothing.
for (const ambiguous of [
  `${block("crates", "10", "Past him.", "He turns.")}\n${block("crates", "10", "Past him.", "He turns.")}`,
  block("crates", "10", "Past him.", "He turns.").replace(
    "[branch: crates]",
    '[skill_check: skill="Perception" dc="10" branch="crates"]\n[branch: crates]',
  ),
]) {
  const lane = laneSession([]);
  const rewrite = await resolveGameTurnBranches(ambiguous, lane.session);
  assert.ok(!rewrite.content.includes("Past him."), rewrite.content);
  assert.ok(!rewrite.content.includes("He turns."), rewrite.content);
  assert.doesNotMatch(rewrite.content, /result="/, "an ambiguous label is never guessed at");
  assert.equal(lane.sheetReads(), 0, "and it costs no sheet read either");
}

// A check tag that sits inside one block cannot be matched by ANOTHER block. If it could,
// the container would be refused for carrying it and re-emit the tag raw, the matching
// block's resolved record would be dropped by the splice's overlap guard, and the saved
// turn would keep a SPARSE engine-rollable tag beside a half a real roll already chose —
// for the shipped resolver to roll a second time and record an outcome that contradicts
// the prose the player reads.
const crossBlock = [
  "[branch: a]",
  "[on success] A1",
  "[on failure] A2",
  '[skill_check: skill="Stealth" dc="15" branch="b"]',
  "[/branch]",
  "[branch: b]",
  "[on success] B1",
  "[on failure] B2",
  "[/branch] tail",
].join("\n");
const crossLane = laneSession([]);
const crossRewrite = await resolveGameTurnBranches(crossBlock, crossLane.session);
for (const half of ["A1", "A2", "B1", "B2"]) {
  assert.ok(
    !crossRewrite.content.includes(half),
    `${half} was kept by a block the engine refused: ${crossRewrite.content}`,
  );
}
assert.doesNotMatch(crossRewrite.content, /result="/, "neither block rolls a tag that lives inside a block");
assert.equal(
  (crossRewrite.content.match(/\[skill_check:/g) ?? []).length,
  1,
  `the ask survives exactly once, so the shipped resolver rolls it once: ${crossRewrite.content}`,
);
assert.match(crossRewrite.content, /branch="b"/, "and it is left for that resolver exactly as written");
assert.equal(crossLane.sheetReads(), 0, "a turn that matched nothing reads no sheet");

// A check the model already filled in cannot select a half: its numbers are exactly what
// the blind form exists to keep out of the decision.
const prefilled = block("crates", "10", "Past him.", "He turns.").replace(
  '[skill_check: skill="Stealth" dc="10" branch="crates"]',
  '[skill_check: skill="Stealth" dc="10" rolls="18" used="18" modifier="0" total="18" result="success" mode="normal" resolution="sum" dice="1d20" branch="crates"]',
);
const prefilledRewrite = await resolveGameTurnBranches(prefilled, laneSession([]).session);
assert.ok(!prefilledRewrite.content.includes("Past him."), prefilledRewrite.content);
assert.ok(!prefilledRewrite.content.includes("He turns."), prefilledRewrite.content);

// A command written inside EITHER half of a refused block is gone with the block, before
// anything downstream could collect it.
const refusedCommands = await resolveGameTurnBranches(
  [
    'Before. [skill_check: skill="Stealth" dc="10" branch="crates"]',
    "[branch: crates]",
    '[on success] Past him. [weather:{"word":"rain"}]',
    "[/branch]",
  ].join("\n"),
  laneSession([15]).session,
);
assert.doesNotMatch(refusedCommands.content, /\[weather:/, refusedCommands.content);

// A turn with no block at all is left byte-identical, and reads no sheet.
const untouched = laneSession([]);
const plain = await resolveGameTurnBranches('He waits. [skill_check: skill="Stealth" dc="10"]', untouched.session);
assert.equal(plain.changed, false);
assert.equal(plain.content, 'He waits. [skill_check: skill="Stealth" dc="10"]');
assert.equal(untouched.sheetReads(), 0);
assert.equal(summarizeGameDiceTurn(untouched.session), null);

// The wrapper's fallback: a thrown arm drops the blocks rather than un-delimiting them,
// because a pass that rolled nothing may not save a turn asserting both outcomes.
const thrownLane = laneSession([]);
const thrown = await runGameTurnChancePass(
  block("crates", "10", "Past him.", "He turns."),
  thrownLane.session,
  () => {
    throw new Error("synthetic arm failure");
  },
  "branch",
);
assert.equal(thrown.changed, true, "the caller is told to set contentReplaced, or the fix is never sent");
assert.ok(!thrown.content.includes("Past him.") && !thrown.content.includes("He turns."), thrown.content);
assert.match(thrown.content, /\[skill_check:/, "the ask survives a thrown pass");
assert.doesNotMatch(thrown.content, /\[branch:|\[on\s|\[\/branch\]/i, thrown.content);
assert.equal(summarizeGameDiceTurn(thrownLane.session)?.passFailed, true);

// ══ 3. The strippers, on both sides ══════════════════════════════════════════

// Belt and braces for a block that reaches saved content anyway — the switch was off, or
// the turn predates the feature. The delimiters go and the prose the player already read
// stays, which is the opposite call from the pass's own failure sweep and deliberately so.
for (const [name, strip] of [
  ["server segment editor", stripGmCommandTags],
  ["client stripGmTags", stripGmTags],
  ["client stripGmTagsKeepReadables", stripGmTagsKeepReadables],
] as const) {
  const stripped = strip(wellFormed);
  assert.doesNotMatch(stripped, /\[branch:|\[on\s|\[\/branch\]/i, `${name}: ${stripped}`);
  assert.ok(stripped.includes("The guard's gaze slides past."), `${name} keeps the prose it is shown`);
  assert.ok(stripped.includes("A boot scuffs stone."), `${name} keeps the prose it is shown`);
  assert.ok(stripped.includes("The corridor waits."), `${name} keeps the prose around the block`);
  // A half marker or a closer with no opener is stripped on its own too, because that is
  // exactly what a block the chance pass could not bound leaves behind.
  assert.doesNotMatch(strip("Dangling [on failure] and [/branch] here."), /\[on\s|\[\/branch\]/i);
}

// THE PIN THAT MATTERS: set membership cannot reach three of the four delimiters, so the
// literal patterns are the fix and not a belt on top of one. `readGmTagHead` requires the
// character after the name to be `:` or `]`, and both the client walks require a `:`. A
// removable name written in the same shape as `[on success]` — a space before the `]` —
// is therefore NOT stripped by any of them, which is what proves the shape is the barrier
// rather than the name.
for (const [name, strip] of [
  ["server segment editor", stripGmCommandTags],
  ["client stripGmTags", stripGmTags],
  ["client stripGmTagsKeepReadables", stripGmTagsKeepReadables],
] as const) {
  assert.equal(strip("[dice: 3d6]").trim(), "", `${name}: a removable name in tag shape is stripped`);
  assert.ok(
    strip("[dice 3d6]").includes("[dice 3d6]"),
    `${name}: the same removable name with a space before the ] is invisible to the name walk`,
  );
}

// ══ 4. The ordering, against the real route ══════════════════════════════════

const db = await getDB();
const chats = createChatsStorage(db);
const movements: Array<{ messageId: string; directive?: AssistantSpatialDirective | null }> = [];
const removeSpatial = registerCapabilityService("hierarchical-maps:state-resolution", {
  resolveEffectiveSpatialState: async () => ({
    definition: null,
    snapshot: null,
    currentLocationId: "chapel",
    definitionRevision: 0,
    visibleAnchor: null,
    virtual: true,
  }),
  materializeAssistantSpatialState: async (input: {
    messageId: string;
    directive?: AssistantSpatialDirective | null;
  }) => {
    movements.push(input);
    return null;
  },
});

// `rolls="N"` is the player's own d20 echoed by the GM, which the resolver uses instead of
// throwing its own. That is what makes a route-driven turn deterministic without replacing
// the crypto roller the real path uses.
let preRolled = 12;
let calls = 0;
function draftFor(roll: number): string {
  return [
    `He edges along the wall. [skill_check: skill="Stealth" dc="10" rolls="${roll}" branch="crates"]`,
    "[branch: crates]",
    '[on success] He slips past. [weather:{"word":"rain"}] [spatial_move: destination_id="crypt"]',
    '[on failure] The guard turns. [weather:{"word":"storm"}] [spatial_move: destination_id="cell"]',
    "[/branch]",
  ].join("\n");
}
const original = ClaudeSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = async function* (
  messages: ChatMessage[],
  options: ChatOptions,
): AsyncGenerator<string, LLMUsage> {
  calls++;
  assert.equal(options.tools, undefined, "subscription transports never receive native tool schemas");
  assert.ok(
    !messages.at(-1)?.content.includes("The engine has now rolled the requested dice:"),
    "the switch holds the narration rewrite closed; a branch turn never makes a second request",
  );
  yield draftFor(preRolled);
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
};

const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  assert.ok(
    await resolveGmVerbTable({ gameExperienceId: "pixelforge" }),
    "fixture installs a real declared verb table",
  );
  const connection = await createConnectionsStorage(db).create({
    name: "Branch ordering",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic",
    maxContext: 32768,
  });

  for (const scenario of ["success", "failure"] as const) {
    preRolled = scenario === "success" ? 12 : 3;
    calls = 0;
    movements.length = 0;
    const chat = await chats.create({
      name: `branch ${scenario}`,
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      gameOneRequestDice: true,
      gameExperienceId: "pixelforge",
      pixelforgeWeather: { word: "fair" },
      enableTools: false,
      enableAgents: true,
      activeAgentIds: ["hierarchical-maps"],
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Sneak past the guard." });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.equal(calls, 1, "a rolled branch turn costs exactly one provider request");

    const saved = (await chats.listMessages(chat.id)).at(-1)!;
    const metadata = JSON.parse((await chats.getById(chat.id))!.metadata);
    const keptHalf = scenario === "success" ? "He slips past." : "The guard turns.";
    const goneHalf = scenario === "success" ? "The guard turns." : "He slips past.";
    assert.ok(saved.content.includes(keptHalf), `${scenario}: ${saved.content}`);
    assert.ok(!saved.content.includes(goneHalf), `${scenario}: the discarded half is gone — ${saved.content}`);
    assert.match(saved.content, new RegExp(`result="${scenario}"`), saved.content);
    assert.doesNotMatch(saved.content, /\[branch:|\[on\s|\[\/branch\]/i, saved.content);
    assert.doesNotMatch(saved.content, /\[weather:|\[spatial_move:/, "both halves' commands are stripped as usual");

    // THE ORDERING PROOF. The verb parse and the spatial extraction both run AFTER the
    // branch arm, so the discarded half's command was never a command: the package state
    // carries the kept half's word and nothing else, and exactly one movement was
    // dispatched, to the kept half's destination.
    assert.deepEqual(metadata.pixelforgeWeather, { word: scenario === "success" ? "rain" : "storm" });
    assert.equal(movements.length, 1, "the host materializes spatial state exactly once on the saved turn");
    assert.equal(movements[0]!.messageId, saved.id);
    assert.deepEqual(movements[0]!.directive, {
      type: "move",
      destinationId: scenario === "success" ? "crypt" : "cell",
    });

    const extra = JSON.parse(saved.extra);
    assert.deepEqual(extra.gameDiceTurn?.forms, ["branch"], "the turn notice records the form that resolved");
    assert.ok(response.body.includes("game_dice_turn_notice"), "and the frame carries it to the client");
  }

  // With the switch OFF nothing in this feature runs: the block stands in the saved text,
  // and the turn behaves exactly as it does today.
  calls = 0;
  movements.length = 0;
  preRolled = 12;
  const off = await chats.create({
    name: "branch switch off",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(off);
  await chats.patchMetadata(off.id, {
    gameExperienceId: "pixelforge",
    pixelforgeWeather: { word: "fair" },
    enableTools: false,
    enableAgents: false,
    gameDiceOutcomeNarration: false,
  });
  await chats.createMessage({ chatId: off.id, role: "user", content: "Sneak past the guard." });
  const offResponse = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: off.id } });
  assert.equal(offResponse.statusCode, 200, offResponse.body);
  const offSaved = (await chats.listMessages(off.id)).at(-1)!;
  assert.ok(offSaved.content.includes("He slips past."), offSaved.content);
  assert.ok(offSaved.content.includes("The guard turns."), "the switch off keeps the turn exactly as written");
  assert.equal(JSON.parse(offSaved.extra).gameDiceTurn, undefined, "and records no dice-turn notice");
  // The strippers still keep the player's view clean, which is the whole reason they
  // learned these four delimiters rather than the arm owning them alone.
  assert.doesNotMatch(stripGmTags(offSaved.content), /\[branch:|\[on\s|\[\/branch\]/i);
} finally {
  ClaudeSubscriptionProvider.prototype.chat = original;
  removeSpatial();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("One-request dice: the die selects a half, a refusal keeps neither, and a discarded command never runs.");
