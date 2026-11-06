/**
 * laptop 2026-10-26, cheap-model GM playtests of an SRD 5e game:
 * - the Game Master picked its own d20 face, by writing a complete record whose sums held up (7 checks,
 *   6 successes) or a sparse `rolls="N"` the Engine adopted as the player's die;
 * - `who="Lethariel"` for the card "Lethariel Moonwhisper" rolled with no modifier and said nothing;
 * - in a game with no persona, a check that named nobody rolled the first card's sheet (Dorra's +1)
 *   for the sneak the narration gave Pip (+8); now it rolls for whom the narration names, and is
 *   refused when the narration names nobody.
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
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-gm-dice-who-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    {
      buildSkillCheckRulesetContext,
      engineIssuedD20Faces,
      playerSubmittedD20Faces,
      resolveSkillCheckTagsInContent,
      rulesetCheckModifierFor,
    },
    { createGameTurnChanceSession, resolveGameTurnBranches },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/one-request-dice.js"),
  ]);

  const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
  const parsedExample = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")));
  assert.ok(parsedExample.ok);
  const fiveE: RulesetDefinition = parsedExample.definition;
  const levelBuild = (level: number, overrides: Partial<RulesetSheetBuild> = {}): RulesetSheetBuild => {
    const base = { ...defaultRulesetSheetBuild(fiveE), ...overrides };
    return { ...base, fields: { ...base.fields, level } };
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
      name: "Mira",
      rulesetSheet: { v: 1, build: levelBuild(5, { abilities: { dex: 16 }, skills: { stealth: "expertise" } }) },
    },
    {
      name: "Tam the Bold",
      rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { str: 18 }, skills: { athletics: "proficient" } }) },
    },
    {
      name: "Lethariel Moonwhisper",
      rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { wis: 16 }, skills: { perception: "proficient" } }) },
    },
    { name: "Pip Wren", rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { dex: 14 } }) } },
    { name: "Pip Hollow", rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { dex: 8 } }) } },
  ];
  const context: SkillCheckModifierContext = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(fiveE, cards, cards[0]),
  };
  const resolve = (content: string, dice: number[], issuedD20s?: number[]) =>
    resolveSkillCheckTagsInContent(content, {
      loadContext: async () => context,
      rollD20: scripted(dice),
      rulesetPinned: true,
      ...(issuedD20s ? { issuedD20s } : {}),
    });

  // ── The player's own die, read off their message ──
  {
    assert.deepEqual(playerSubmittedD20Faces("I sneak. [dice: 1d20 = 14]"), [14]);
    assert.deepEqual(playerSubmittedD20Faces("[dice: 1d20+3 = 17 (14 +3)]"), [14]);
    assert.deepEqual(playerSubmittedD20Faces("[dice: 2d20 = 25 (12, 13)]"), [12, 13]);
    assert.deepEqual(playerSubmittedD20Faces("[dice: 2d6 = 7 (3, 4)] [dice: 1d100 = 20]"), []);
    assert.deepEqual(playerSubmittedD20Faces("I sneak past the guard."), []);
    assert.deepEqual(
      engineIssuedD20Faces([
        { notation: "1d20+3", rolls: [11] },
        { notation: "1d8", rolls: [4] },
        { notation: "2d20", rolls: [2, 19] },
      ]),
      [11, 2, 19],
    );
  }

  // ── A complete record stands only on a die somebody else threw ──
  {
    const tidy = `She slips past. [skill_check: skill="Stealth" dc="15" rolls="18" used="18" modifier="9" total="27" result="success" mode="normal" resolution="sum" dice="1d20"]`;
    // Sheet-true numbers on a face nobody threw: the Engine rolls it.
    const picked = await resolve(tidy, [4], []);
    assert.equal(picked.resolved, 1, "a face the Game Master picked is not vouched for");
    assert.match(picked.content, /rolls="4" used="4" modifier="9" total="13" result="failure"/);
    // The player threw an 18 this turn: the record stands as written.
    const thrown = await resolve(tidy, [], [18]);
    assert.deepEqual([thrown.content, thrown.trusted, thrown.resolved], [tidy, 1, 0]);
    // One thrown die answers one check.
    const twice = await resolve(`${tidy} ${tidy}`, [6], [18]);
    assert.equal(twice.resolved, 1);
    assert.match(twice.content, /total="27" result="success".*rolls="6" used="6" modifier="9" total="15"/);
    // A saved turn read back with no dice in hand is read as it always was.
    const reread = await resolve(tidy, []);
    assert.deepEqual([reread.content, reread.trusted], [tidy, 1]);
  }

  // ── A sparse `rolls="N"` is the player's die only when the player threw it ──
  {
    const sparse = `[skill_check: skill="Stealth" dc="15" rolls="17"]`;
    const invented = await resolve(sparse, [3], []);
    assert.match(invented.content, /rolls="3" used="3" modifier="9" total="12" result="failure"/);
    const theirs = await resolve(sparse, [], [17]);
    assert.match(theirs.content, /rolls="17" used="17" modifier="9" total="26" result="success"/);
    // Without a ruleset too: the same die-picking, the same rule.
    const legacy = await resolveSkillCheckTagsInContent(sparse, {
      loadContext: async () => ({ skills: { Stealth: 2 }, attributes: null, sheetAttributes: { dex: 14 } }),
      rollD20: scripted([5]),
      issuedD20s: [],
    });
    assert.match(legacy.content, /rolls="5" used="5"/);
    // The one-request branch arm reads `rolls=` by the same rule, and what it rolls the pass after
    // it vouches for.
    const session = createGameTurnChanceSession({
      db: null as never,
      chatId: "gm-dice",
      roll: scripted([2]),
      loadModifierContext: async () => context,
      playerD20s: [],
    });
    const branched = await resolveGameTurnBranches(
      [
        `[skill_check: skill="Stealth" dc="15" rolls="20" branch="sneak"]`,
        "[branch: sneak]",
        "[on success] Unseen.",
        "[on failure] Spotted.",
        "[/branch]",
      ].join("\n"),
      session,
    );
    assert.match(branched.content, /rolls="2" used="2" modifier="9" total="11" result="failure"/);
    assert.match(branched.content, /Spotted\./);
    assert.doesNotMatch(branched.content, /Unseen/);
    assert.deepEqual(session.issuedD20s, [2]);
    const after = await resolve(branched.content, [], session.issuedD20s!);
    assert.equal(after.content, branched.content, "the Engine's own branch roll is not rolled again");
  }

  // ── who= by a shorter name ──
  {
    const short = await resolve(`[skill_check: skill="Perception" dc="12" who="Lethariel"]`, [9]);
    assert.match(short.content, /modifier="5" total="14" result="success"/, "WIS +3 and proficiency +2");
    assert.equal(
      rulesetCheckModifierFor(context.ruleset!, "Athletics", "Tam"),
      6,
      "a first name one card answers to is that card",
    );
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Perception", "Moonwhisper"), 5);
    // Two cards answer to "Pip", and nobody answers to "the": strangers, as before.
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Stealth", "Pip"), 0);
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Athletics", "the"), 0);
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Stealth", "Pip Wren"), 2);
    // A tool the sheet does not name, with no with=, rolls with the roller's best ability (laptop room
    // playtest 2026-10-30: leatherworking rolled +0); a with= still decides, a stranger has nothing.
    const abilityOf = (label: string) => rulesetCheckModifierFor(context.ruleset!, label, "Tam");
    const best = Math.max(...context.ruleset!.definition.sheet.abilities.map((ability) => abilityOf(ability.label)));
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Leatherworker's tools", "Tam"), best);
    assert.equal(
      rulesetCheckModifierFor(context.ruleset!, "Leatherworker's tools", "Tam", "Wisdom"),
      abilityOf("Wisdom"),
    );
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Leatherworker's tools", "Pip"), 0);
    assert.equal(rulesetCheckModifierFor(context.ruleset!, "Basket weaving", "Tam"), 0, "only a tool, kit or set");
  }

  // ── A check that names nobody, where no card is the player's ──
  {
    const party = [
      { name: "Dorra", rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { dex: 12 } }) } },
      {
        name: "Pip Tumblewick",
        rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { dex: 18 }, skills: { stealth: "expertise" } }) },
      },
    ];
    const built = buildSkillCheckRulesetContext(fiveE, party, party[0]);
    const directed: SkillCheckModifierContext = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: { ...built, playerByPosition: true },
    };
    const run = (content: string, ruleset = directed, dice = [10]) =>
      resolveSkillCheckTagsInContent(content, {
        loadContext: async () => ruleset,
        rollD20: scripted(dice),
        rulesetPinned: true,
      });
    const pip = await run(`Dorra waits. Pip slips into the shadows. [skill_check: skill="Stealth" dc="13"]`);
    assert.match(pip.content, /modifier="8" total="18" result="success".*who="Pip Tumblewick"/);
    const dorra = await run(`Dorra creeps along the wall. [skill_check: skill="Stealth" dc="13"]`);
    assert.match(dorra.content, /modifier="1" total="11" result="failure".*who="Dorra"/);
    // The tag on a line of its own after the telling, and a check before it named its own roller.
    const ownLine = await run(
      `[skill_check: skill="Athletics" dc="5" who="Pip"] Pip boosts Dorra up.\n\nDorra creeps along the ledge.\n\n[skill_check: skill="Stealth" dc="13"]`,
      directed,
      [10, 10],
    );
    assert.match(ownLine.content, /who="Pip"\].*modifier="1" total="11" result="failure"[^\]]*who="Dorra"\]$/s);
    // Named only after the tag, in the same paragraph.
    const later = await run(`The hall is dark. [skill_check: skill="Stealth" dc="13"] Pip holds her breath.`);
    assert.match(later.content, /who="Pip Tumblewick"/);
    // Nobody named: nobody is picked (cheap-GM playtest 2026-10-26); the check is refused, and says why.
    const nobody = await run(`The party creeps on. [skill_check: skill="Stealth" dc="13"]`, directed, []);
    assert.match(nobody.content, /reason="unknown-roller"\]$/);
    const reread = parseSkillCheckTagBody(nobody.content.slice(nobody.content.indexOf("[skill_check:") + 13, -1));
    assert.deepEqual([reread?.who, reread?.reason], [undefined, "unknown-roller"]);
    // A player with a card of their own is still the one a nameless check is for.
    const owned = await run(`Pip slips into the shadows. [skill_check: skill="Stealth" dc="13"]`, {
      ...directed,
      ruleset: built,
    });
    assert.match(
      owned.content,
      /modifier="1" total="11" result="failure" mode="normal" resolution="sum" dice="1d20"\]$/,
    );
  }

  console.info("game ruleset GM dice and who regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
