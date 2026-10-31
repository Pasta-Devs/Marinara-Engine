/**
 * Cheap-GM playtest 2026-10-26 (`who=` on checks): a card named `Marigold "Mars" Thimblewick` rolled a
 * flat d20 for `who="Mars"`, and a `who=` several members answer to, or a check naming nobody, rolled
 * for somebody with no word to the Game Master.
 * - A `who=` finds its card by the whole name, the name written with its nickname, the name without
 *   it, a first name or the nickname alone, when only one card answers.
 * - One that reads as a party member but picks out no one card (a name or nickname several share, a
 *   name half-right, the party) is not rolled: the ask is saved with reason="unknown-roller", which
 *   settles it, and the Game Master reads why.
 * - One naming somebody outside the party ("A Guard") is rolled on a plain die, so the Game Master
 *   can still roll for its NPCs.
 * - Where nobody is the player's own and several could roll, a check naming nobody is rolled for the
 *   member the narration gives it to, and refused when the narration names nobody.
 * - The one-request branch arm refuses the same checks, keeping neither half.
 * - Alyssa 2026-10-30: `who="party"` (or "everyone", "the whole party") is a group check. Every member
 *   rolls on their own sheet, each gets their own record, and the party succeeds when at least half
 *   pass; a branch keeps the party's half.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-check-roller-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, checkRecordsAsHistoryNotes, resolveSkillCheckTagsInContent },
    { createGameTurnChanceSession, resolveGameTurnBranches },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/one-request-dice.js"),
  ]);
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");

  const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
  const parsed = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")));
  assert.ok(parsed.ok);
  const fiveE: RulesetDefinition = parsed.definition;
  const build = (overrides: Partial<RulesetSheetBuild>): RulesetSheetBuild => {
    const base = { ...defaultRulesetSheetBuild(fiveE), ...overrides };
    return { ...base, fields: { ...base.fields, level: 1 } };
  };
  const scripted = (values: number[]) => {
    let index = 0;
    return () => {
      assert.ok(index < values.length, "asked for more d20s than scripted");
      return values[index++]!;
    };
  };
  const cards = [
    {
      name: `Marigold "Mars" Thimblewick`,
      rulesetSheet: { v: 1, build: build({ abilities: { dex: 16 }, skills: { stealth: "proficient" } }) },
    },
    { name: "Dagna Ironhand", rulesetSheet: { v: 1, build: build({ abilities: { str: 16 } }) } },
    { name: "Pip Wren", rulesetSheet: { v: 1, build: build({ abilities: { dex: 14 } }) } },
    { name: "Pip Hollow", rulesetSheet: { v: 1, build: build({ abilities: { dex: 8 } }) } },
  ];
  const built = buildSkillCheckRulesetContext(fiveE, cards, cards[0]);
  // The player's own card is the first one.
  const owned: SkillCheckModifierContext = { skills: null, attributes: null, sheetAttributes: {}, ruleset: built };
  // Nobody is the player's own: the first card only stands in.
  const directed: SkillCheckModifierContext = { ...owned, ruleset: { ...built, playerByPosition: true } };
  const run = (content: string, dice: number[], context = owned) =>
    resolveSkillCheckTagsInContent(content, {
      loadContext: async () => context,
      rollD20: scripted(dice),
      rulesetPinned: true,
    });

  // ── A nickname and a first name find the card ──
  for (const who of [`Marigold "Mars" Thimblewick`, "Marigold Thimblewick", "Mars", "Marigold", "Thimblewick"]) {
    const tag = parseSkillCheckTagBody(` skill="Stealth" dc="15" who="${who}"`);
    assert.equal(tag?.who, who, `who="${who}" is read whole`);
    const rolled = await run(`[skill_check: skill="Stealth" dc="15" who="${who}"]`, [10]);
    assert.match(rolled.content, /modifier="5" total="15" result="success"/, `who="${who}": DEX +3, proficiency +2`);
    assert.equal(rolled.unknownRoller, undefined);
  }
  assert.match((await run(`[skill_check: skill="Athletics" dc="10" who="Dagna"]`, [10])).content, /modifier="3"/);

  // ── Somebody outside the party: a plain die, as before ──
  for (const who of ["A Guard", "Bob", "the"]) {
    const npc = await run(`[skill_check: skill="Stealth" dc="12" who="${who}"]`, [10]);
    assert.match(npc.content, /modifier="0" total="10" result="failure"/, `who="${who}" rolls flat`);
    assert.equal(npc.unknownRoller, undefined);
  }

  // ── Several or half a name: refused, not a flat die ──
  for (const who of ["Pip", "Pip Thimblewick", "Mars Hollow"]) {
    const refused = await run(`She tries. [skill_check: skill="Stealth" dc="12" who="${who}"]`, []);
    assert.equal(
      refused.content,
      `She tries. [skill_check: skill="Stealth" dc="12" who="${who}" reason="unknown-roller"]`,
      `who="${who}" rolls nothing`,
    );
    assert.deepEqual([refused.resolved, refused.unknownRoller], [0, { count: 1, written: [who] }]);
    // Settled: read again, it stays as it is and rolls nothing.
    const again = await run(refused.content, []);
    assert.equal(again.content, refused.content);
  }
  // Even with the GM's own tidy numbers on it, which used to stand on a flat modifier.
  const forged = await run(
    `[skill_check: skill="Stealth" dc="12" rolls="15" used="15" modifier="0" total="15" result="success" mode="normal" resolution="sum" dice="1d20" who="Pip"]`,
    [],
  );
  assert.match(
    forged.content,
    /^\[skill_check: skill="Stealth" dc="12" dice="1d20" who="Pip" reason="unknown-roller"\]$/,
  );
  assert.equal(
    checkRecordsAsHistoryNotes(forged.content),
    `(Engine: Stealth check not rolled: "Pip" does not name one party member.)`,
  );

  // ── The whole party: a group check, everyone on their own sheet ──
  for (const who of ["party", "the whole party", "Everyone"]) {
    // Mars +5, Dagna +0, Pip Wren +2, Pip Hollow -1 against 12: 15, 10, 12, 9.
    const group = await run(`They creep on. [skill_check: skill="Stealth" dc="12" who="${who}"]`, [10, 10, 10, 10]);
    const records = [...group.content.matchAll(/\[skill_check:[^\]]*\]/g)].map((match) => match[0]);
    assert.equal(records.length, 4, `who="${who}": one record each`);
    assert.match(records[0]!, /total="15" result="success"[^\]]*who=.Marigold/);
    assert.match(records[1]!, /total="10" result="failure"[^\]]*who="Dagna Ironhand"/);
    assert.match(records[2]!, /total="12" result="success"[^\]]*who="Pip Wren"/);
    assert.match(records[3]!, /total="9" result="failure"[^\]]*who="Pip Hollow"/);
    assert.ok(group.content.endsWith(`(Group Stealth check against 12: 2 of 4 passed, so the party succeeds.)`));
    assert.equal(group.unknownRoller, undefined);
    assert.equal(group.results?.length, 4);
    // Settled: read again, nothing is rolled.
    assert.equal((await run(group.content, [])).content, group.content);
  }
  const caught = await run(`[skill_check: skill="Stealth" dc="12" who="party"]`, [10, 5, 5, 5]);
  assert.ok(caught.content.endsWith(`(Group Stealth check against 12: 1 of 4 passed, so the party fails.)`));
  assert.equal(
    checkRecordsAsHistoryNotes(caught.content).match(/\(Engine roll for /g)?.length,
    4,
    "each member's roll reads back as their own",
  );

  // ── Naming nobody ──
  // The player has a card: theirs, as always.
  assert.match((await run(`[skill_check: skill="Stealth" dc="15"]`, [10])).content, /modifier="5" total="15"/);
  // Nobody's own: whom the narration names, else refused.
  const named = await run(`Dagna shoulders the door. [skill_check: skill="Athletics" dc="10"]`, [10], directed);
  assert.match(named.content, /modifier="3" total="13" result="success"[^\]]*who="Dagna Ironhand"/);
  const nameless = await run(`The party creeps on. [skill_check: skill="Stealth" dc="13"]`, [], directed);
  assert.equal(
    nameless.content,
    `The party creeps on. [skill_check: skill="Stealth" dc="13" reason="unknown-roller"]`,
    "no hero is picked for the party",
  );
  assert.deepEqual(nameless.unknownRoller, { count: 1, written: [""] });
  assert.equal(
    checkRecordsAsHistoryNotes(nameless.content),
    `The party creeps on. (Engine: Stealth check not rolled: it named no one party member.)`,
  );
  // One card to roll for: the check is theirs.
  const alone = buildSkillCheckRulesetContext(fiveE, cards.slice(0, 1), cards[0]);
  const lone = await run(`[skill_check: skill="Stealth" dc="15"]`, [10], {
    ...owned,
    ruleset: { ...alone, playerByPosition: true },
  });
  assert.match(lone.content, /modifier="5" total="15"/);

  // ── The one-request branch arm ──
  {
    const session = createGameTurnChanceSession({
      db: null as never,
      chatId: "cheap-gm-roller",
      roll: scripted([]),
      loadModifierContext: async () => owned,
      playerD20s: [],
    });
    const branched = await resolveGameTurnBranches(
      [
        `[skill_check: skill="Stealth" dc="12" who="Pip" branch="sneak"]`,
        "[branch: sneak]",
        "[on success] Unseen.",
        "[on failure] Spotted.",
        "[/branch]",
      ].join("\n"),
      session,
    );
    assert.match(branched.content, /\[skill_check: skill="Stealth" dc="12" who="Pip" reason="unknown-roller"\]/);
    assert.doesNotMatch(branched.content, /Unseen|Spotted/, "neither half happened");
    const rolled = await resolveGameTurnBranches(
      [
        `[skill_check: skill="Stealth" dc="12" who="Mars" branch="sneak"]`,
        "[branch: sneak]",
        "[on success] Unseen.",
        "[on failure] Spotted.",
        "[/branch]",
      ].join("\n"),
      createGameTurnChanceSession({
        db: null as never,
        chatId: "cheap-gm-roller",
        roll: scripted([10]),
        loadModifierContext: async () => owned,
        playerD20s: [],
      }),
    );
    assert.match(rolled.content, /modifier="5" total="15" result="success"/);
    assert.match(rolled.content, /Unseen\./);
    // A group check keeps the party's half.
    const together = await resolveGameTurnBranches(
      [
        `[skill_check: skill="Stealth" dc="12" who="party" branch="sneak"]`,
        "[branch: sneak]",
        "[on success] Unseen.",
        "[on failure] Spotted.",
        "[/branch]",
      ].join("\n"),
      createGameTurnChanceSession({
        db: null as never,
        chatId: "cheap-gm-roller",
        roll: scripted([10, 5, 5, 5]),
        loadModifierContext: async () => owned,
        playerD20s: [],
      }),
    );
    assert.match(together.content, /1 of 4 passed, so the party fails\.\)/);
    assert.match(together.content, /Spotted\./);
    assert.doesNotMatch(together.content, /Unseen/);
  }

  // ── The brief says so, in a line ──
  {
    const reminder = buildGmFormatReminder({ hasSceneModel: true, ruleset: fiveE } as never);
    assert.match(
      reminder,
      /A who that could be several party members is not rolled; anyone outside the party rolls a plain die\. For something the whole party does together[^.]*\), write who="party": everyone rolls, and the party succeeds when at least half of them pass\./,
    );
  }

  console.info("cheap-GM check roller regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
