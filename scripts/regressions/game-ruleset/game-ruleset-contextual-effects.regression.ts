/** Capability API 1.156: worked-out ability scores, and rows or entries applied to one roll by name. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetBuilderAbilityIds,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-contextual-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const parse = (doc: unknown): RulesetDefinition => {
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const issuesOf = (doc: unknown) => {
  const parsed = parseRulesetDefinition(doc);
  return parsed.ok ? "" : parsed.issues.join("; ");
};

try {
  const { buildSkillCheckRulesetContext, resolveSkillCheckWithContext } =
    await import("../../../packages/server/src/services/game/skill-check-resolution.service.js");
  const { buildGmFormatReminder } = await import("../../../packages/server/src/services/game/gm-prompts.js");
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

  // ── A summed ruleset: a worked-out score, authored stunts and an entry that costs to apply ──
  const fiveE = () => {
    const doc = read("../../../docs/development/ruleset-5e-2014.example.json");
    doc.sheet.fields.push({
      id: "per_bought",
      label: "Perception bought",
      type: "number",
      min: 0,
      max: 10,
      default: 0,
    });
    doc.sheet.abilities.push({
      id: "per",
      label: "Perception",
      min: 1,
      max: 30,
      default: 10,
      value: [{ abilityScore: "wis" }, { field: "per_bought" }],
    });
    doc.sheet.skills.find((skill: any) => skill.id === "perception").ability = "per";
    doc.sheet.lists.push({
      id: "stunts",
      label: "Stunts",
      maxItems: 10,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "skill", label: "Skill", type: "text", maxLength: 40 },
        { id: "bonus", label: "Bonus", type: "number", min: -5, max: 5, default: 2 },
      ],
      contextual: { name: "name", skill: "skill", bonus: "bonus" },
    });
    doc.catalogs.push({
      id: "boons",
      label: "Boons",
      feeds: ["features"],
      entries: [
        {
          id: "lucky-break",
          label: "Lucky Break",
          rows: [{ list: "features", values: { name: "Lucky Break", text: "Once in a while, luck turns." } }],
          mechanics: {
            kind: "utility",
            contextual: { effects: ["own-checks-advantage"], cost: [{ pool: "hit_dice", amount: 1 }] },
          },
        },
      ],
    });
    doc.sheet.builder = {
      steps: [{ id: "scores", label: "Scores", kind: "abilities", methods: { manual: true } }],
    };
    return doc;
  };
  const definition = parse(fiveE());

  // The worked-out score reads what it adds up, ignores what is stored, and the skill rolls with it.
  const base = defaultRulesetSheetBuild(definition);
  const build: RulesetSheetBuild = {
    ...base,
    abilities: { ...base.abilities, wis: 12, per: 3 },
    fields: { ...base.fields, per_bought: 3 },
  };
  const evaluated = evaluateRulesetSheet(definition, build);
  assert.equal(evaluated.abilityScores.per, 15);
  assert.equal(evaluated.abilityMods.per, 2);
  assert.equal(evaluated.skillMods.perception, 2);
  const passive = definition.sheet.derived.find((entry) => JSON.stringify(entry).includes('"perception"'));
  assert.ok(passive, "the example ruleset has a derived value that reads perception");
  assert.equal(evaluated.derived[passive.id], 12, "a derived value reads the worked-out score");
  assert.ok(!rulesetBuilderAbilityIds(definition, definition.sheet.builder!.steps[0] as any).includes("per"));

  const withRows: RulesetSheetBuild = {
    ...build,
    lists: {
      ...build.lists,
      stunts: [
        { name: "Strong Back", skill: "athletics", bonus: 2 },
        { name: "Quick Eye", skill: "", bonus: 1 },
        { name: "Twice", skill: "athletics", bonus: 1 },
        { name: "Twice", skill: "athletics", bonus: 1 },
      ],
      features: [
        ...(build.lists.features ?? []),
        ...rowsFromCatalogEntry("boons", definition.catalogs!.at(-1)!.entries![0]!).map((entry) => entry.row),
      ],
    },
  };
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  const cards = [{ name: "Ada", rulesetSheet: { v: 1, build: withRows } }];
  const context = (ruleset: RulesetDefinition, sheets = cards, live: RulesetLiveStates | null = null) =>
    ({
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(ruleset, sheets, sheets[0], live, catalogs),
    }) as SkillCheckModifierContext;
  const roll = (
    ctx: SkillCheckModifierContext,
    request: Parameters<typeof resolveSkillCheckWithContext>[1],
    persist = true,
  ) => {
    let written: RulesetLiveStates | null = null;
    const result = resolveSkillCheckWithContext(
      ctx,
      request,
      () => 10,
      persist ? (key, state) => (written = { ...(written ?? {}), [key]: state }) : undefined,
    );
    return { result, written };
  };

  // Owning a stunt changes nothing; applying it to its own skill does, and the record says so.
  const plain = roll(context(definition), { skill: "Athletics", dc: 10 });
  const strong = roll(context(definition), { skill: "Athletics", dc: 10, apply: ["strong back"] });
  assert.equal(strong.result.total, plain.result.total + 2);
  assert.ok(strong.result.from?.includes("Strong Back"));
  // Not on another skill, never twice, and never a name two rows answer to.
  const elsewhere = roll(context(definition), { skill: "Stealth", dc: 10, apply: ["Strong Back"] });
  assert.equal(elsewhere.result.from, undefined);
  const both = roll(context(definition), { skill: "Athletics", dc: 10, apply: ["Strong Back", "Quick Eye", "Twice"] });
  assert.equal(both.result.total, plain.result.total + 3, "a row with no skill applies to any check");
  assert.ok(!both.result.from?.includes("Twice"));

  // An entry's applied effect pays its cost once, through the caller that keeps it.
  const leftOf = (live: RulesetLiveStates | null) =>
    readRulesetLive(definition, withRows, live?.ada).pools.find((pool) => pool.key === "hit_dice")!.value;
  const full = leftOf(null);
  const lucky = roll(context(definition), { skill: "Athletics", dc: 10, apply: ["Lucky Break"] });
  assert.equal(lucky.result.rollMode, "advantage");
  assert.equal(leftOf(lucky.written), full - 1);
  const unpaid = roll(context(definition), { skill: "Athletics", dc: 10, apply: ["Lucky Break"] }, false);
  assert.equal(unpaid.result.rollMode, "normal", "nobody to keep the payment, so nothing applies");
  const broke = roll(context(definition, cards, { ada: { pools: { hit_dice: { value: 0 } } } }), {
    skill: "Athletics",
    dc: 10,
    apply: ["Lucky Break"],
  });
  assert.equal(broke.result.rollMode, "normal", "a cost the pool cannot cover applies nothing");
  assert.equal(broke.written, null);

  // The tag carries up to four names, and the Game Master is taught the attribute.
  assert.deepEqual(parseSkillCheckTagBody('skill="Athletics" dc="10" apply="Strong Back; Quick Eye"')?.apply, [
    "Strong Back",
    "Quick Eye",
  ]);
  const prompt = buildGmFormatReminder({ hasSceneModel: true, ruleset: definition } as any);
  assert.match(prompt, /apply="Its name"/);
  assert.match(prompt, /\(Stunts\)/);

  // ── A pool ruleset: specialties that make a face explode and add a die ──
  const gravewatchDoc = () => {
    const doc = read("../../../docs/examples/rulesets/gravewatch.json");
    doc.sheet.lists.push({
      id: "specialties",
      label: "Specialties",
      maxItems: 10,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "skill", label: "Skill", type: "text", maxLength: 40 },
      ],
      contextual: { name: "name", skill: "skill", check: { dice: 1, explode: 9 } },
    });
    return doc;
  };
  const gravewatch = parse(gravewatchDoc());
  const graveBuild = {
    ...defaultRulesetSheetBuild(gravewatch),
    lists: { specialties: [{ name: "Old graves", skill: "Wrestle" }] },
  } as RulesetSheetBuild;
  const graveCards = [{ name: "Bram", rulesetSheet: { v: 1, build: graveBuild } }];
  const graveContext = () =>
    ({
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(gravewatch, graveCards, graveCards[0], null, {}),
    }) as SkillCheckModifierContext;
  const dug = roll(graveContext(), { skill: "Wrestle", dc: 1, apply: ["Old graves"] });
  assert.equal(dug.result.explodeFrom, 9);
  assert.ok(dug.result.from?.includes("Old graves"));
  const listened = roll(graveContext(), { skill: "Ward", dc: 1, apply: ["Old graves"] });
  assert.equal(listened.result.explodeFrom, undefined);

  // ── Refused at import ──
  const broken = (change: (doc: any) => void, make = fiveE) => {
    const doc = make();
    change(doc);
    return issuesOf(doc);
  };
  assert.match(
    broken((doc) => {
      doc.sheet.derived.push({ id: "watch", label: "Watch", op: "sum", of: [{ abilityMod: "per" }] });
      doc.sheet.abilities.at(-1).value.push({ derived: "watch" });
    }),
    /cannot read another worked-out score/,
  );
  assert.match(
    broken((doc) => doc.sheet.abilities.at(-1).value.push({ abilityScore: "per" })),
    /cannot read another worked-out score/,
  );
  assert.match(
    broken((doc) => (doc.sheet.builder.steps[0].abilities = ["per"])),
    /"per" is worked out, not set by the builder/,
  );
  assert.match(
    broken((doc) => (doc.sheet.lists.at(-1).contextual.bonus = "name")),
    /not a number column/,
  );
  assert.match(
    broken((doc) => (doc.sheet.lists.at(-1).contextual.check = { dice: 1 })),
    /A dice-sum ruleset has no pool for a check effect to change/,
  );
  assert.match(
    broken((doc) => (doc.catalogs.at(-1).entries[0].mechanics.contextual.cost[0].pool = "nope")),
    /Unknown pool or pool group "nope"/,
  );
  assert.match(
    broken((doc) => (doc.catalogs.at(-1).entries[0].mechanics.contextual = { modifiers: [{ to: "speed", flat: 1 }] })),
    /changes checks or saves/,
  );
  assert.match(
    broken((doc) => (doc.sheet.lists.at(-1).contextual.check = { explode: 7 }), gravewatchDoc),
    /lets a check move explode from 8 to 10/,
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "contextual",
    name: "Contextual",
    version: "1.0.0",
    description: "Contextual proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, value: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, value);
  assert.match(issue(155, fiveE()) ?? "", /1\.156/);
  assert.equal(issue(156, fiveE()), null);
  const entryOnly = fiveE();
  entryOnly.sheet.abilities.pop();
  entryOnly.sheet.skills.find((skill: any) => skill.id === "perception").ability = "wis";
  delete entryOnly.sheet.lists.at(-1).contextual;
  assert.match(issue(155, entryOnly) ?? "", /1\.156/, "an entry's applied effect alone needs 1.156");
  delete entryOnly.catalogs.at(-1).entries[0].mechanics;
  assert.equal(issue(155, entryOnly), null);
  console.log("game-ruleset-contextual-effects: passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
