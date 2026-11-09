/**
 * The ruleset builder: every dice preset writes a ruleset the Engine accepts and rolls.
 *
 * What is pinned here:
 *   - Each preset's starter draft, as written out, passes the ruleset parser, keeps its stats, skills,
 *     pools and tracks, and carries the builder's mark and its own draft so the builder can open it.
 *   - Each preset rolls the way its family rolls (a d20 total, 2d6 bands, a pool's successes, the
 *     highest d6, a d100 under the sheet's number, Hope and Fear).
 *   - Labels become ids that are unique and safe, and a skill naming no stat is left out.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RULESET_BUILDER_MARK,
  renderRulesetSheetBlock,
  parseRulesetDefinition,
  rulesetBuilderDraftFrom,
  rulesetBuilderStarter,
  rulesetFromBuilderDraft,
  type RulesetBuilderDicePreset,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-builder-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { buildSkillCheckRulesetContext, resolveSkillCheckWithContext } =
    await import("../../packages/server/src/services/game/skill-check-resolution.service.js");
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("\n"));
    return result.definition;
  };
  const roll = (definition: RulesetDefinition, skill: string, dc: number) => {
    const cards = [{ name: "Blake", rulesetSheet: null }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(definition, cards, cards[0]),
    };
    return resolveSkillCheckWithContext(context as any, { skill, dc });
  };

  const presets: RulesetBuilderDicePreset[] = [
    "d20",
    "2d6-bands",
    "pool",
    "highest",
    "percentile",
    "duality",
    "diceless",
  ];
  for (const preset of presets) {
    const draft = rulesetBuilderStarter(preset, `Test ${preset}`);
    draft.skills = [
      { label: "Sneak", ability: draft.abilities[0]!.label },
      { label: "Nowhere", ability: "No such stat" },
    ];
    const doc = rulesetFromBuilderDraft(draft, 3);
    const definition = parsed(doc);
    assert.equal(definition.version, 3);
    assert.equal(definition.sheet.abilities.length, draft.abilities.length, `${preset}: the stats`);
    assert.deepEqual(
      definition.sheet.skills.map((skill) => skill.label),
      ["Sneak"],
      `${preset}: a skill naming no stat is left out`,
    );
    assert.equal(definition.sheet.live.pools.length, draft.pools.length, `${preset}: the pools`);
    assert.equal(definition.sheet.live.tracks.length, draft.tracks.length, `${preset}: the tracks`);
    // The narrator can raise what the sheet holds, or a diceless sheet could never record a rank-up.
    assert.equal(definition.sheet.advancement?.abilities, true, `${preset}: stats can be raised`);
    assert.equal(definition.sheet.advancement?.skills, true, `${preset}: skill ranks can be set`);
    assert.equal((doc as { $comment?: string }).$comment, RULESET_BUILDER_MARK);
    const back = rulesetBuilderDraftFrom(definition as any);
    assert.ok(back, `${preset}: the builder can open what it wrote`);
    assert.equal(back!.dice.preset, preset, `${preset}: the preset reads back`);
    assert.deepEqual(back!.skills, [{ label: "Sneak", ability: draft.abilities[0]!.label }]);
    assert.equal(
      definition.resolution.proficiencyTiers.length,
      1 + draft.ranks.length,
      `${preset}: untrained plus each skill rank`,
    );
    assert.deepEqual(back!.ranks, draft.ranks, `${preset}: the ranks read back`);
    assert.deepEqual(back!.pools, draft.pools, `${preset}: pools and their bars read back`);
    assert.deepEqual(back!.tracks, draft.tracks, `${preset}: tracks and their bars read back`);
    assert.deepEqual(back!.lists, draft.lists, `${preset}: lists, tabs and columns read back`);
    assert.equal(back!.checkGuidance, undefined, `${preset}: default guidance reads back blank`);
    assert.deepEqual(
      parsed(rulesetFromBuilderDraft(back!, 3)),
      definition,
      `${preset}: a reopened draft writes the same ruleset`,
    );
    // A diceless ruleset is never rolled; its prompt is checked below.
    if (preset === "diceless") continue;
    const result = roll(definition, "Sneak", draft.ladder[0]!.value);
    assert.equal(typeof result.success, "boolean", `${preset}: the check rolls`);
    switch (preset) {
      case "d20":
        assert.equal(result.rolls.length, 1);
        assert.ok(result.rolls[0]! >= 1 && result.rolls[0]! <= 20);
        break;
      case "2d6-bands":
        assert.equal(result.rolls.length, 2);
        assert.ok(["Strong hit", "Weak hit", "Miss"].includes(result.outcome ?? ""), `2d6 band: ${result.outcome}`);
        break;
      case "highest":
        assert.ok(
          ["Critical", "Full success", "Partial success", "Bad outcome"].includes(result.outcome ?? ""),
          `highest band: ${result.outcome}`,
        );
        break;
      case "percentile":
        assert.ok(result.rolls[0]! >= 1 && result.rolls[0]! <= 100);
        break;
      case "duality":
        assert.equal(result.rolls.length, 2);
        assert.ok(["Hope", "Fear", "tie"].includes(result.duality ?? ""), `duality: ${result.duality}`);
        break;
      default:
        break;
    }
  }

  // The layout: skill groups become sections, a list with a tab sits on that tab, a bar is drawn, and
  // the prompt text is held to one line.
  {
    const draft = rulesetBuilderStarter("d20", "Layout Test");
    draft.skills = [
      { label: "Sneak", ability: "Dexterity", group: "Moves" },
      { label: "Climb", ability: "Strength", group: "moves" },
      { label: "Lore", ability: "Intelligence" },
    ];
    draft.checkGuidance = "Ask for checks\nonly when it matters.";
    draft.sheetGuidance = "Mark Stress on a push.";
    draft.rulesReference = "Rule one.\r\n\r\nRule two.";
    draft.worldGuidance = "No gunpowder.";
    draft.abilities[0]!.group = "Physical";
    draft.abilities[1]!.group = "Physical";
    const definition = parsed(rulesetFromBuilderDraft(draft));
    const moves = definition.sheet.sections.filter((section) => section.label === "Moves");
    assert.equal(moves.length, 1, "two groups that differ only in case are one section");
    assert.deepEqual(
      definition.sheet.skills.map((skill) => skill.section ?? null),
      [moves[0]!.id, moves[0]!.id, null],
    );
    const gear = definition.sheet.lists.find((list) => list.label === "Gear")!;
    assert.equal(gear.display?.tab, "Gear");
    assert.equal(gear.display?.mark, undefined, "a list with no checkbox column has no tick");
    {
      const ticked = rulesetBuilderStarter("d20", "Tick Test");
      ticked.lists = [{ label: "Gear", columns: [{ label: "Equipped", type: "check" }] }];
      const list = parsed(rulesetFromBuilderDraft(ticked)).sheet.lists[0]!;
      assert.equal(list.display?.mark, "equipped", "the first checkbox column is the tick");
    }
    assert.equal(
      definition.sheet.lists.find((list) => list.label === "Notes")?.display?.tab,
      "Notes",
      "a list given no tab gets one named after it, since the sheet shows lists only on tabs",
    );
    assert.deepEqual(
      gear.columns.map((column) => column.type),
      ["text", "number", "text"],
      "a list is named by its first column",
    );
    assert.equal(definition.sheet.live.pools[0]!.display, "bar");
    assert.equal(definition.gm.checkGuidance, "Ask for checks only when it matters.");
    assert.equal(definition.gm.sheetGuidance, "Mark Stress on a push.");
    assert.equal(definition.gm.worldGuidance, "No gunpowder.");
    assert.equal(definition.gmReference, "Rule one. Rule two.");
    const back = rulesetBuilderDraftFrom(definition as any)!;
    assert.deepEqual(
      back.skills.map((skill) => skill.group ?? null),
      ["Moves", "Moves", null],
    );
    assert.equal(back.rulesReference, "Rule one. Rule two.");
    assert.equal(back.worldGuidance, "No gunpowder.");
    const physical = definition.sheet.sections.find((section) => section.label === "Physical")!;
    assert.deepEqual(
      definition.sheet.abilities.slice(0, 3).map((ability) => ability.section ?? null),
      [physical.id, physical.id, null],
      "stats with a group show under its heading",
    );
    assert.deepEqual(
      back.abilities.slice(0, 3).map((ability) => ability.group ?? null),
      ["Physical", "Physical", null],
    );
    assert.equal(
      parsed(rulesetFromBuilderDraft({ ...draft, abilities: draft.abilities.map(({ group: _g, ...rest }) => rest) }))
        .sheet.abilities[0]!.id,
      definition.sheet.abilities[0]!.id,
      "a group never changes a stat's id",
    );
  }

  // Diceless (1.825): marked as such, read back as such, and the narrator is never asked for a check.
  {
    const { buildRulesetRoleplayReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
    const definition = parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("diceless", "No Dice")));
    assert.equal(definition.gm.diceless, true);
    assert.equal(definition.coverage.checks, false);
    const back = rulesetBuilderDraftFrom(definition as any)!;
    assert.equal(back.dice.preset, "diceless");
    assert.deepEqual(back.ladder, [], "a diceless ruleset shows no difficulties");
    assert.equal(back.checkGuidance, undefined, "the diceless default reads back blank");
    const reminder = buildRulesetRoleplayReminder({ ruleset: definition, sheetBlocks: [] });
    assert.ok(!reminder.includes("[skill_check: skill="), "no check tag is taught");
    assert.ok(reminder.includes("has no dice") && reminder.includes("OUTCOMES:"), reminder);
    // The sheet reads in ranks, not roll modifiers, and a sheet with nothing to restore has no rest.
    const ranked = rulesetBuilderStarter("diceless", "Ranked");
    ranked.skills = [{ label: "Smithing", ability: "Body" }];
    ranked.tracks = [];
    ranked.fields = [{ label: "SP", type: "number" }];
    const rankedDefinition = parsed(rulesetFromBuilderDraft(ranked));
    assert.deepEqual(rankedDefinition.rests, [], "nothing to restore, no rest");
    assert.deepEqual(rankedDefinition.sheet.advancement?.fields, ["sp"], "SP can be advanced");
    const block = renderRulesetSheetBlock(
      rankedDefinition,
      {
        name: "Blake",
        build: {
          abilities: { body: 3 },
          skills: { smithing: "rank_2" },
          saves: {},
          bonuses: {},
          fields: { sp: 35 },
          lists: {},
        } as any,
      },
      undefined,
    );
    assert.ok(block.includes("Smithing Adept"), block);
    assert.ok(block.includes("BOD 3") && !block.includes("+3"), block);
    const withDice = buildRulesetRoleplayReminder({
      ruleset: parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("d20", "Dice"))),
      sheetBlocks: [],
    });
    assert.ok(
      withDice.includes("[skill_check: skill=") && withDice.includes("CHECKS:"),
      "a ruleset with dice still teaches checks",
    );
  }

  // Labels that would collide or are not ids still make a ruleset.
  {
    const draft = rulesetBuilderStarter("d20", "Odd Labels");
    draft.abilities = [
      { label: "Might!", min: 0, max: 5, default: 1 },
      { label: "might", min: 0, max: 5, default: 1 },
      { label: "9 Lives", min: 0, max: 9, default: 9 },
    ];
    draft.pools = [{ label: "Might", max: 3 }];
    const definition = parsed(rulesetFromBuilderDraft(draft));
    const ids = [...definition.sheet.abilities.map((a) => a.id), ...definition.sheet.live.pools.map((p) => p.id)];
    assert.equal(new Set(ids).size, ids.length, `ids are unique: ${ids.join(", ")}`);
  }

  assert.equal(
    rulesetBuilderDraftFrom(
      parsed(
        JSON.parse(readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8")),
      ) as any,
    ),
    null,
    "a ruleset the builder did not write is left to its author",
  );

  console.log("ruleset-builder regression passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
