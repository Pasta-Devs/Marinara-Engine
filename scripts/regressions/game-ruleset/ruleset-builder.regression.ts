/**
 * The ruleset builder (#9017): a form that writes an ordinary ruleset.
 *
 * What is pinned here:
 *   - Every dice preset writes a ruleset the Engine accepts, and "No dice" is the summed check with
 *     no dice (1.825), not a ruleset that never rolls.
 *   - The starters are plain words, not a shipped system's stats.
 *   - Ids stay put: a renamed stat, pool, field, list or column keeps its id, and a new row named like
 *     an old one does not take it.
 *   - The builder opens a ruleset only when it can write it back unchanged, whoever wrote it, and keeps
 *     a file's own edition and license.
 *   - A new ruleset never takes an installed ruleset's id.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  RULESET_BUILDER_MAX,
  rulesetBuilderDraftFrom,
  rulesetBuilderFreeId,
  rulesetBuilderKey,
  rulesetBuilderPresetOf,
  rulesetBuilderProblems,
  rulesetBuilderStarter,
  rulesetFromBuilderDraft,
  type RulesetBuilderDicePreset,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const parsed = (document: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(document);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const example = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../docs/examples/rulesets/${name}.json`, import.meta.url)), "utf8"),
  );

// Every preset is a working ruleset, reads back as itself, and plays the dice it says.
const presets: RulesetBuilderDicePreset[] = ["d20", "2d6-bands", "pool", "highest", "percentile", "duality", "no-dice"];
for (const preset of presets) {
  const draft = rulesetBuilderStarter(preset, "Test Rules");
  draft.skills = [{ key: rulesetBuilderKey(), label: "Climb", ability: draft.abilities[0]!.key, group: "Body work" }];
  draft.practice = true;
  const written = rulesetFromBuilderDraft(draft);
  const definition = parsed(written);
  assert.equal(rulesetBuilderPresetOf(definition.resolution as any), preset, `${preset} reads as itself`);
  const back = rulesetBuilderDraftFrom(definition as any);
  assert.ok(back, `${preset}: the builder opens what it wrote`);
  assert.deepEqual(rulesetFromBuilderDraft(back), written, `${preset}: saving it unchanged changes nothing`);
  // A sheet on it builds and reads.
  const block = renderRulesetSheetBlock(definition, { name: "Ash", build: defaultRulesetSheetBuild(definition) }, {});
  assert.ok(block.length > 0);
}
const noDice = parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("no-dice")));
assert.equal(noDice.resolution.kind, "dice-sum");
assert.equal((noDice.resolution as { dice: { count: number } }).dice.count, 0, "no dice is dice.count 0");
assert.equal((noDice.gm as Record<string, unknown>).diceless, undefined, "and not a ruleset that never rolls");

// The starters are not 5e's six abilities, nor any other shipped system's.
const d20 = rulesetBuilderStarter("d20");
assert.notDeepEqual(
  d20.abilities.map((ability) => ability.label),
  ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
);
// A shipped ruleset is recognised by its dice, so the form can point at it instead.
assert.equal(rulesetBuilderPresetOf(example("ember-roads").resolution), "2d6-bands");
assert.equal(rulesetBuilderPresetOf({ kind: "dice-sum", dice: { count: 1, sides: 20 } }), "d20");
assert.equal(rulesetBuilderPresetOf(example("gravewatch").resolution), "pool");

// Ids stay put across a rename.
{
  const draft = rulesetBuilderStarter("d20", "Renames");
  draft.skills = [{ key: rulesetBuilderKey(), label: "Climb", ability: draft.abilities[0]!.key }];
  const first = parsed(rulesetFromBuilderDraft(draft));
  const open = rulesetBuilderDraftFrom(first as any)!;
  assert.ok(open);
  open.abilities[0]!.label = "Brawn";
  open.skills[0]!.label = "Scale";
  open.pools[0]!.label = "Vigour";
  open.fields[0]!.label = "Calling";
  open.lists[0]!.label = "Kit";
  open.lists[0]!.columns[0]!.label = "Count";
  // A new stat named like the old one gets its own id.
  open.abilities.push({ key: rulesetBuilderKey(), label: "Might", min: 0, max: 5, default: 0 });
  const second = parsed(rulesetFromBuilderDraft(open, 2));
  const ids = (definition: RulesetDefinition) => ({
    ability: definition.sheet.abilities[0]!.id,
    skill: definition.sheet.skills[0]!.id,
    pool: definition.sheet.live.pools[0]!.id,
    field: definition.sheet.fields[0]!.id,
    list: definition.sheet.lists[0]!.id,
    column: definition.sheet.lists[0]!.columns[1]!.id,
  });
  assert.deepEqual(ids(second), ids(first), "a rename keeps every id");
  assert.equal(second.sheet.abilities[0]!.label, "Brawn");
  assert.equal(second.sheet.skills[0]!.ability, first.sheet.abilities[0]!.id, "the skill still rolls its stat");
  const added = second.sheet.abilities.at(-1)!;
  assert.equal(added.label, "Might");
  assert.notEqual(added.id, first.sheet.abilities[0]!.id, "a new row never takes an old row's id");
  // A rank added between keeps the others' ids.
  const ranks = rulesetBuilderDraftFrom(second as any)!;
  ranks.ranks.splice(1, 0, { key: rulesetBuilderKey(), label: "Skilled", bonus: 3 });
  const third = parsed(rulesetFromBuilderDraft(ranks, 3));
  assert.deepEqual(
    third.resolution.proficiencyTiers.map((tier) => tier.id),
    ["untrained", "rank_1", "rank_3", "rank_2"],
  );
}

// The builder opens any ruleset it could write back unchanged, and no other.
assert.equal(rulesetBuilderDraftFrom(example("ember-roads")), null, "a ruleset with combat is its author's");
assert.equal(rulesetBuilderDraftFrom(example("gravewatch")), null);
{
  const handWritten = {
    ...rulesetFromBuilderDraft(rulesetBuilderStarter("percentile", "Hand Made")),
    edition: "First draft",
    license: { spdx: "CC-BY-4.0", attribution: "By its author." },
  };
  const open = rulesetBuilderDraftFrom(parsed(handWritten) as any);
  assert.ok(open, "a hand-written file the form can hold opens");
  const saved = rulesetFromBuilderDraft(open);
  assert.equal(saved.edition, "First draft", "and keeps its own edition");
  assert.deepEqual(saved.license, handWritten.license);
  // A sheet the narrator may not advance stays that way.
  const { advancement: _advancement, ...fixedSheet } = handWritten.sheet as Record<string, unknown>;
  const fixed = rulesetBuilderDraftFrom(parsed({ ...handWritten, sheet: fixedSheet }) as any);
  assert.ok(fixed, "a file without advancement opens");
  assert.equal((rulesetFromBuilderDraft(fixed).sheet as Record<string, unknown>).advancement, undefined);
  const rests = handWritten.rests as Array<Record<string, unknown>>;
  const extra = parsed({ ...handWritten, rests: [...rests, { ...rests[0], id: "long_rest", label: "Long rest" }] });
  assert.equal(rulesetBuilderDraftFrom(extra as any), null, "a second rest, which the form lacks, keeps it out");
  const derived = parsed({
    ...handWritten,
    sheet: {
      ...(handWritten.sheet as object),
      derived: [
        { id: "half", label: "Half", op: "scale", of: { abilityScore: "body" }, multiplier: 0.5, round: "down" },
      ],
    },
  });
  assert.equal(rulesetBuilderDraftFrom(derived as any), null, "a derived value keeps it out");
}

// Practice, bars and dots are written as the sheet docs teach.
{
  const draft = rulesetBuilderStarter("pool", "Learners");
  draft.skills = [
    { key: rulesetBuilderKey(), label: "Smithing", ability: draft.abilities[0]!.key, group: "Crafts" },
    { key: rulesetBuilderKey(), label: "History", ability: draft.abilities[1]!.key, group: "Knowledge" },
  ];
  draft.practice = true;
  draft.practiceExcept = ["knowledge"];
  draft.pools = [{ key: rulesetBuilderKey(), label: "Hunger", max: 5, display: "dots" }];
  const definition = parsed(rulesetFromBuilderDraft(draft));
  const knowledge = definition.sheet.sections.find((section) => section.label === "Knowledge")!.id;
  assert.deepEqual(definition.sheet.progress, { except: [knowledge] });
  assert.equal(definition.sheet.live.tracks[0]!.display, "bar");
  assert.equal(definition.sheet.live.pools[0]!.display, "dots");
  const back = rulesetBuilderDraftFrom(definition as any)!;
  assert.deepEqual(back.practiceExcept, ["Knowledge"]);
  assert.equal(back.pools[0]!.display, "dots", "dots come back into the form");
  assert.equal(back.tracks[0]!.display, "bar");
}

// A row the writer could not keep stops the save instead of being dropped.
{
  const draft = rulesetBuilderStarter("d20", "Checks");
  assert.deepEqual(rulesetBuilderProblems(draft), [], "a starter saves as it is");
  draft.skills = [{ key: rulesetBuilderKey(), label: "Lore", ability: "gone" }];
  draft.pools = [{ key: rulesetBuilderKey(), label: "Luck", max: 0 }];
  draft.tracks = [{ key: rulesetBuilderKey(), label: "Doom", min: 3, max: 3 }];
  draft.checkGuidance = "Roll [stat] + skill";
  assert.deepEqual(rulesetBuilderProblems(draft), ["orphanSkill", "emptyPool", "emptyTrack", "unsafeText"]);
  const clean = rulesetBuilderStarter("d20", "Checks");
  clean.abilities[0]!.label = "Might\tand main";
  assert.deepEqual(rulesetBuilderProblems(clean), ["unsafeText"], "a tab in a name");
  clean.abilities[0]!.label = "Might";
  clean.rulesReference = "Line one\n\tLine two";
  assert.deepEqual(rulesetBuilderProblems(clean), [], "a prompt may break lines and indent");
  // Blank difficulties are left out and twelve is the most kept; a tab in a prompt becomes a space.
  clean.ladder = [{ label: "", value: 5 }, ...Array.from({ length: 13 }, (_, n) => ({ label: `Step ${n}`, value: n }))];
  const written = parsed(rulesetFromBuilderDraft(clean));
  assert.equal(written.resolution.difficultyLadder.length, 12);
  assert.equal(written.resolution.difficultyLadder[0]!.label, "Step 0");
  assert.equal(written.gmReference?.includes("\t"), false);
}

// A stat's short name follows a rename unless it was set apart from the name.
{
  const draft = rulesetBuilderStarter("d20", "Shorts");
  const back = rulesetBuilderDraftFrom(parsed(rulesetFromBuilderDraft(draft)) as any)!;
  back.abilities[0]!.label = "Strength";
  assert.equal(parsed(rulesetFromBuilderDraft(back)).sheet.abilities[0]!.short, "STR");
}

// A comment is the author's, so a file with one stays out of the builder.
{
  const commented = parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("d20", "Noted"))) as any;
  assert.ok(rulesetBuilderDraftFrom(commented), "the same file without a comment opens");
  assert.equal(rulesetBuilderDraftFrom({ ...commented, $comment: "house rules from 2019" }), null);
  // The Edit button reads the stored file, where a comment can sit anywhere and a root `$schema` is kept.
  const nested = structuredClone(commented);
  nested.sheet.abilities[0].$comment = "rolled 4d6, drop the lowest";
  assert.equal(rulesetBuilderDraftFrom(nested), null, "a comment on one stat");
  assert.equal(rulesetBuilderDraftFrom({ $schema: "./ruleset.schema.json", ...commented }), null, "a root $schema");
}

// `display: "counter"` is the number alone, as no display is, so a file that spells it out still opens.
{
  const spelled = parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("d20", "Spelled"))) as any;
  const rows = [...(spelled.sheet.live?.pools ?? []), ...(spelled.sheet.live?.tracks ?? [])];
  assert.ok(rows.length > 0, "the starter has a pool or track");
  for (const row of rows) row.display = "counter";
  assert.ok(rulesetBuilderDraftFrom(spelled), "an explicit counter display opens");
}

// The form stops adding rows where the writer stops writing them, so no row it shows is dropped,
// and a form full to every cap still writes a ruleset the Engine takes, whatever its dice.
for (const preset of presets) {
  const many = rulesetBuilderStarter(preset, "Many");
  many.lists = Array.from({ length: RULESET_BUILDER_MAX.lists }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `List ${index + 1}`,
    columns: Array.from({ length: RULESET_BUILDER_MAX.columns }, (_, column) => ({
      key: rulesetBuilderKey(),
      label: `Column ${column + 1}`,
      type: "text" as const,
    })),
  }));
  many.abilities = Array.from({ length: RULESET_BUILDER_MAX.abilities }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Stat ${index + 1}`,
    min: 0,
    max: 5,
    default: 0,
  }));
  many.skills = Array.from({ length: RULESET_BUILDER_MAX.skills }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Skill ${index + 1}`,
    ability: many.abilities[index % many.abilities.length]!.key,
  }));
  many.ladder = Array.from({ length: RULESET_BUILDER_MAX.ladder }, (_, index) => ({
    label: `Step ${index + 1}`,
    value: 5 + index,
  }));
  many.pools = Array.from({ length: RULESET_BUILDER_MAX.pools }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Pool ${index + 1}`,
    max: 5,
  }));
  many.tracks = Array.from({ length: RULESET_BUILDER_MAX.tracks }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Track ${index + 1}`,
    min: 0,
    max: 5,
  }));
  many.fields = Array.from({ length: RULESET_BUILDER_MAX.fields }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Field ${index + 1}`,
    type: "text" as const,
  }));
  many.ranks = Array.from({ length: RULESET_BUILDER_MAX.ranks }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Rank ${index + 1}`,
    bonus: index + 1,
  }));
  const written = parsed(rulesetFromBuilderDraft(many)) as any;
  assert.equal(written.sheet.abilities.length, RULESET_BUILDER_MAX.abilities);
  assert.equal(written.sheet.skills.length, RULESET_BUILDER_MAX.skills);
  assert.equal(written.sheet.live.pools.length, RULESET_BUILDER_MAX.pools);
  assert.equal(written.sheet.live.tracks.length, RULESET_BUILDER_MAX.tracks);
  assert.equal(written.sheet.fields.length, RULESET_BUILDER_MAX.fields);
  assert.equal(written.sheet.lists.length, RULESET_BUILDER_MAX.lists);
  assert.equal(written.sheet.lists[0].columns.length, RULESET_BUILDER_MAX.columns + 1, "plus the name column");
  assert.equal(written.resolution.proficiencyTiers.length, RULESET_BUILDER_MAX.ranks + 1, "plus untrained");
}

// A row removed in the form leaves its values on the sheets, so a new row named like it gets its own id:
// a stat, a skill rank and a list column, each removed and added back under the same name.
{
  const start = rulesetBuilderStarter("d20", "Reused");
  start.ranks = [
    { key: rulesetBuilderKey(), label: "Trained", bonus: 2 },
    { key: rulesetBuilderKey(), label: "Expert", bonus: 4 },
  ];
  start.lists = [
    {
      key: rulesetBuilderKey(),
      label: "Gear",
      columns: [{ key: rulesetBuilderKey(), label: "Weight", type: "number" }],
    },
  ];
  const opened = rulesetBuilderDraftFrom(parsed(rulesetFromBuilderDraft(start)) as any)!;
  const oldStat = opened.abilities[0]!;
  const oldRank = opened.ranks.at(-1)!;
  const oldColumn = opened.lists[0]!.columns[0]!;
  opened.abilities = [
    ...opened.abilities.slice(1),
    { key: rulesetBuilderKey(), label: oldStat.label, min: 0, max: 5, default: 0 },
  ];
  opened.skills = opened.skills.map((skill) =>
    skill.ability === oldStat.key ? { ...skill, ability: opened.abilities[0]!.key } : skill,
  );
  opened.ranks = [...opened.ranks.slice(0, -1), { key: rulesetBuilderKey(), label: oldRank.label, bonus: 4 }];
  opened.lists[0]!.columns = [{ key: rulesetBuilderKey(), label: oldColumn.label, type: "number" }];
  const next = parsed(rulesetFromBuilderDraft(opened, 2)) as any;
  const statIds = next.sheet.abilities.map((ability: { id: string }) => ability.id);
  assert.ok(!statIds.includes(oldStat.id), `a new stat does not take ${oldStat.id}: ${statIds}`);
  const rankIds = next.resolution.proficiencyTiers.map((tier: { id: string }) => tier.id);
  assert.ok(!rankIds.includes(oldRank.id), `a new rank does not take ${oldRank.id}: ${rankIds}`);
  const columnIds = next.sheet.lists[0].columns.map((column: { id: string }) => column.id);
  assert.ok(!columnIds.includes(oldColumn.id), `a new column does not take ${oldColumn.id}: ${columnIds}`);
}

// A sheet holds 20 groups: each stat or skill group, one per list and one for the fields. The form
// stops the save past that, and a form at exactly 20 writes a ruleset the Engine takes.
{
  const grouped = rulesetBuilderStarter("d20", "Grouped");
  grouped.abilities = Array.from({ length: RULESET_BUILDER_MAX.abilities }, (_, index) => ({
    key: rulesetBuilderKey(),
    label: `Stat ${index + 1}`,
    min: 0,
    max: 5,
    default: 0,
    group: `Group ${index + 1}`,
  }));
  grouped.skills = [];
  grouped.lists = [];
  grouped.fields = [];
  assert.ok(!rulesetBuilderProblems(grouped).includes("tooManySections"), "20 groups is the limit, not past it");
  assert.equal((parsed(rulesetFromBuilderDraft(grouped)) as any).sheet.sections.length, 20);
  grouped.fields = [{ key: rulesetBuilderKey(), label: "Concept", type: "text" }];
  assert.ok(rulesetBuilderProblems(grouped).includes("tooManySections"), "the fields' group makes 21");
  assert.equal(parseRulesetDefinition(rulesetFromBuilderDraft(grouped)).ok, false, "which the Engine refuses");
}

// A file's own license line is not the form's to check: a bracket in it doesn't stop every save.
{
  const licensed = parsed(rulesetFromBuilderDraft(rulesetBuilderStarter("d20", "Licensed"))) as any;
  licensed.license = { spdx: "CC-BY-4.0", attribution: "Rules adapted from [Some Game] by Someone" };
  const opened = rulesetBuilderDraftFrom(parsed(licensed) as any);
  assert.ok(opened, "the file opens");
  assert.deepEqual(rulesetBuilderProblems(opened), []);
}

// A new ruleset never takes an installed ruleset's id.
assert.equal(rulesetBuilderFreeId("My Rules", ["local/my-rules-ab12", "my-rules-ab12-2"], "ab12"), "my-rules-ab12-3");
assert.equal(rulesetBuilderFreeId("Fresh", ["5e-2014"], "zz00"), "fresh-zz00");

// Nor a removed one's: two rulesets built under the same name, with nothing installed in between, get different
// ids, so the second never picks up the first one's sheets on cards or its pinned chats.
{
  const ids = new Set(Array.from({ length: 20 }, () => rulesetBuilderFreeId("My Ruleset", [])));
  assert.ok(ids.size > 1, "repeated names get different ids");
  for (const id of ids) {
    assert.match(id, /^my-ruleset-[a-z0-9]{4}$/);
    parsed(rulesetFromBuilderDraft({ ...rulesetBuilderStarter("d20"), id }, 1));
  }
}

// The id checked against the taken ones is the id the writer stores, for a long name too, and with a "-n".
for (const name of ["x".repeat(80), `${"a".repeat(37)} ${"b".repeat(40)}`]) {
  const first = rulesetBuilderFreeId(name, [], "ab12");
  const second = rulesetBuilderFreeId(name, [`local/${first}`], "ab12");
  assert.equal(second, `${first}-2`);
  for (const id of [first, second]) {
    assert.ok(id.length <= 48, id);
    assert.equal(parsed(rulesetFromBuilderDraft({ ...rulesetBuilderStarter("d20"), id }, 1)).id, id);
  }
}

console.log("Ruleset builder regressions passed.");
