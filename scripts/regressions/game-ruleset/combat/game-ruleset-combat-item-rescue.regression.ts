/**
 * A rescue on a worn item's use (Capability API 1.259): a ring of evasion, its Dexterity saves made
 * for the reaction and one of the ring's own charges, only while it is worn and has one left.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-rescue-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 254);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cutting = {
    id: "cutting-words",
    label: "Cutting Words",
    rows: [
      { list: "features", values: { name: "Cutting Words" } },
      { list: "counters", values: { name: "Inspiration", max: 3, recharge: "short" } },
    ],
    mechanics: {
      kind: "debuff",
      budget: "reaction",
      targets: "enemy",
      range: 60,
      usesOf: "Inspiration",
      needs: ["hearing"],
      targetTypes: { notImmuneTo: ["charmed"] },
      reaction: { on: "hit" },
      lowersRoll: { dice: "1d6", also: ["checks", "damage"] },
    },
  };
  const ring = {
    id: "ring-of-evasion",
    label: "Ring of Evasion",
    rows: [
      { list: "features", values: { name: "Ring of Evasion" } },
      { list: "counters", values: { name: "Ring Charges", max: 3, recharge: "long" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Ring Charges",
      rescue: { roll: "saves", by: "success", saves: ["dex_save"], budget: "reaction" },
    },
  };
  const features = [cutting, ring] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "deafened_now", label: "Deaf" }, { id: "mind_blank", label: "Mind Blank" });
    doc.combat.conditions.push(
      { condition: "deafened_now", effects: [], lacks: ["hearing"] },
      { condition: "mind_blank", effects: [], conditionImmunities: ["charmed"] },
    );
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "heroic",
      label: "Heroic",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(fiveE());
  // The d20s in the order they are thrown; every other die shows 3.
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const rows = (list: string, keep: string[]) =>
    features
      .filter((entry) => keep.includes(entry.id))
      .flatMap((entry) => rowsFromCatalogEntry("heroic", entry).flatMap((one) => (one.list === list ? [one.row] : [])));
  const sheet = (keep: string[], extra: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      // +4 Strength and +4 proficiency: a Greataxe at +8. Dexterity saves at +0.
      abilities: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
      fields: { level: 9, ac: 15, speed: 30, hp_max: 90, ...extra },
      lists: {
        attacks: [{ name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 }],
        features: rows("features", keep),
        counters: rows("counters", keep),
      },
    });
  const breath = {
    id: "breath",
    name: "Breath",
    budget: "action",
    range: 60,
    save: { save: "dex_save", difficulty: 15, onSuccess: "half" as const },
    damage: { count: 0, sides: 0, flat: 10, type: "fire" },
  };
  const glare = {
    id: "glare",
    name: "Glare",
    budget: "action",
    range: 60,
    save: { save: "wis_save", difficulty: 15, onSuccess: "negates" as const },
    damage: { count: 0, sides: 0, flat: 10, type: "psychic" },
  };
  const block = (health: number): RulesetStatBlock =>
    ({
      health,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [breath, glare],
    }) as unknown as RulesetStatBlock;
  /** The hero, and on the other side a bard with Cutting Words and a foe. */
  const fight = (
    options: {
      health?: number;
      bard?: boolean;
      heroKeeps?: string[];
      items?: RulesetSheetItem[];
      /** The bard on the hero's own side. */
      ally?: boolean;
      /** Cutting Words off attack rolls only, as before 1.257. */
      plain?: boolean;
      /** Cutting Words pointed at anybody, either side. */
      anybody?: boolean;
    } = {},
  ): RulesetEncounterState => {
    const entries =
      options.plain || options.anybody
        ? features.map((one) => {
            const copy = structuredClone(one) as unknown as {
              mechanics: { targets: string; lowersRoll?: { also?: unknown } };
            };
            if (options.plain) delete copy.mechanics.lowersRoll?.also;
            if (options.anybody && copy.mechanics.lowersRoll) copy.mechanics.targets = "any";
            return copy as unknown as RulesetCatalogEntry;
          })
        : features;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { heroic: entries },
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: sheet(options.heroKeeps ?? []),
          live: {},
          items: options.items ?? [],
          catalogs: { heroic: features },
        },
        // A party member is a character; somebody on the other side, a creature with a sheet.
        options.ally
          ? {
              id: "bard",
              name: "Bard",
              side: "party",
              build: sheet(["cutting-words"]),
              live: {},
              catalogs: { heroic: entries },
            }
          : ({
              id: "bard",
              name: "Bard",
              side: "enemy",
              block: { sheet: sheet(options.bard === false ? [] : ["cutting-words"]), actions: [] },
            } as RulesetCombatantInput),
        { id: "foe", name: "Foe", side: "enemy", block: block(options.health ?? 200) },
      ],
    });
    state.order = ["hero", "bard", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "hero") => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const take = (state: RulesetEncounterState, label: string, actorId: string, targetIds: string[]) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const counter = (state: RulesetEncounterState, id: string, key: string) => {
    const one = who(state, id);
    return readRulesetLive(definition, one.sheet!.build, one.sheet!.live).pools.find((pool) => pool.key === key)?.value;
  };
  const grapple = (state: RulesetEncounterState, ...rolls: number[]) => {
    d20s = rolls;
    return take(state, "Grapple", "hero", ["foe"]);
  };

  const ringItem = (charges: number, worn = true): RulesetSheetItem =>
    ({
      name: "Ring of Evasion",
      quantity: 1,
      worn,
      charges,
      item: {
        category: "gear",
        slots: { hands: 1 },
        charges: { max: 3 },
        use: {
          kind: "buff",
          targets: "self",
          free: true,
          charges: 1,
          rescue: { roll: "saves", by: "success", saves: ["dex_save"], budget: "reaction" },
        },
      } as unknown as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const breathed = (state: RulesetEncounterState, label: string, ...rolls: number[]) => {
    state.turn = 2;
    who(state, "foe").budgets.action = 1;
    d20s = rolls;
    return take(state, label, "foe", ["hero"]);
  };

  // ── Worn, with charges: a failed Dexterity save made, for the reaction and a charge ──
  {
    const state = fight({ items: [ringItem(3)], bard: false });
    assert.equal(
      rulesetCombatOptions(definition, state, "hero").some((one) => one.label === "Ring of Evasion"),
      false,
      "never on the menu",
    );
    const step = breathed(state, "Breath", 5);
    assert.equal(of(step.events, "rescued")[0]?.label, "Ring of Evasion");
    assert.equal(of(step.events, "damage")[0]!.dealt, 5, "half, as a success");
    assert.deepEqual(
      of(step.events, "uses").map((one) => [one.label, one.left, one.of]),
      [["Ring of Evasion", 2, 3]],
    );
    assert.equal(who(step.state).budgets.reaction, 0);
    // Its reaction spent, the next failed save stands.
    assert.equal(of(breathed(step.state, "Breath", 5).events, "rescued").length, 0);
    // Not a Wisdom save.
    assert.equal(of(breathed(fight({ items: [ringItem(3)], bard: false }), "Glare", 5).events, "rescued").length, 0);
  }

  // ── No charge left, or not worn: nothing ──
  {
    const spent = breathed(fight({ items: [ringItem(0)], bard: false }), "Breath", 5);
    assert.equal(of(spent.events, "rescued").length, 0, "no charge");
    assert.equal(of(spent.events, "damage")[0]!.dealt, 10);
    const pocket = breathed(fight({ items: [ringItem(3, false)], bard: false }), "Breath", 5);
    assert.equal(of(pocket.events, "rescued").length, 0, "not worn");
  }

  // ── Import ──
  {
    const scroll = (use: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.push({
          id: "rings",
          label: "Rings",
          holds: "items",
          entries: [
            {
              id: "ring",
              label: "Ring of Evasion",
              item: {
                category: "gear",
                stack: 1,
                charges: { max: 3 },
                use: { kind: "buff", targets: "self", free: true, charges: 1, ...use },
              },
            },
          ],
        });
      });
    parsed(scroll({ rescue: { roll: "saves", by: "success", saves: ["dex_save"], budget: "reaction" } }));
    refused(scroll({ rescue: { roll: "saves", by: "success", budget: "nope" } }), /Unknown budget "nope"/);
  }

  // ── The install gate: 1.259 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = "A ruleset with rescues on an item's use requires schemaVersion 2 and capabilityApi 1.259 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, undefined as never);
    const document = structuredClone(without);
    document.extra = { item: { use: { rescue: { roll: "saves", by: "reroll" } } } };
    assert.equal(issue(258, document), gate);
    assert.notEqual(issue(259, document), gate);
    assert.notEqual(issue(258, without), gate);
  }

  console.log(
    "Ruleset item rescues: a worn ring of evasion makes a failed Dexterity save for the reaction and a charge; gated at 1.259.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
