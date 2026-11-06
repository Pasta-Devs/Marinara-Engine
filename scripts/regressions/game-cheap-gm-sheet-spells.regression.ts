/**
 * Cheap-GM playtest 2026-10-26 (the Game Master's `<character_sheets>` block): careful models refused
 * Guidance and Fire Bolt, and never knew of Archery or Colossus Slayer, because the block left them out.
 *
 * The block names exactly the lists the ruleset's `gm.sheetSummary.lists` asks for, so this pins what
 * the Engine does with what it is given:
 * - a cantrip row the builder wrote without a Prepared cell reads as the column's default and is
 *   listed under its level, beside the prepared spells; an unprepared spellbook spell is not;
 * - a features list is named, compactly and by name only, once the ruleset lists it there. The 5e
 *   package (0.440) lists only `spells` and `attacks`, so its features, fighting style, invocations
 *   and pact boon (lists `features`, `eldritch`, `pact`) need entries in `gm.sheetSummary.lists`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const document = JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")) as Record<string, any>;
const parse = (doc: Record<string, any>): RulesetDefinition => {
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const shipped = parse(document);
const base = defaultRulesetSheetBuild(shipped);
const build: RulesetSheetBuild = {
  ...base,
  fields: { ...base.fields, level: 3, spellcasting_ability: "wis" },
  lists: {
    spells: [
      { name: "Guidance", level: 0 },
      { name: "Produce Flame", level: 0 },
      { name: "Cure Wounds", level: 1, prepared: true },
      { name: "Sleep", level: 1, prepared: false },
    ],
    features: [
      { name: "Fighting Style: Archery", text: "You gain a +2 bonus to attack rolls you make with ranged weapons." },
      { name: "Hunter's Prey: Colossus Slayer", text: "Once per turn, an extra 1d8 damage to a wounded foe." },
    ],
  },
};
const card = { name: "Wren", build };

// ── Spells: cantrips beside the prepared ones ──
const block = renderRulesetSheetBlock(shipped, card, {});
const spellLine = block.split("\n").find((line) => line.startsWith("Spells"));
assert.equal(spellLine, "Spells (0): Guidance, Produce Flame; (1): Cure Wounds");
assert.doesNotMatch(block, /Sleep/, "an unprepared spell is not offered");
// What the shipped summary leaves out stays out: the Engine names no list the ruleset did not ask for.
assert.doesNotMatch(block, /Archery|Colossus/);

// ── Features, once the ruleset lists them ──
const listed = parse({
  ...document,
  gm: {
    ...document.gm,
    sheetSummary: {
      ...document.gm.sheetSummary,
      lists: [...document.gm.sheetSummary.lists, { list: "features", nameColumn: "name" }],
    },
  },
});
const withFeatures = renderRulesetSheetBlock(listed, card, {});
const featureLine = withFeatures.split("\n").find((line) => line.startsWith("Features and traits"));
assert.equal(featureLine, "Features and traits: Fighting Style: Archery, Hunter's Prey: Colossus Slayer");
assert.doesNotMatch(withFeatures, /\+2 bonus|extra 1d8/, "names only: the rules text stays on the sheet");
// Compact: the line costs about what its names do.
assert.ok(featureLine!.length < 90, `feature line is ${featureLine!.length} characters`);

console.info("cheap-GM sheet spells regressions passed.");
