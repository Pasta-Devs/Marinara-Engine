/**
 * Held weapons in attack rules, what is wielded, and rows every sheet has (Capability API 1.244).
 *
 *   - `combat.attacks[].always`: rows every sheet's fight has, in the list's own columns, unless the
 *     sheet has a row of the same name: 5e's unarmed strike.
 *   - An `attackRows` rule's `items` changes held weapons' attacks by tags (a club +1 is a monk
 *     weapon), and `names` matches a held weapon by the name its attack goes by.
 *   - `wielding.only`: a rule, or a granted strike, holds only while every weapon held is one of
 *     these, or none is. `grantsStrike.when` keeps a granted strike within the sheet's bounds.
 *   - `afterAttack`'s `items` (1.246): the attack action taken with a club +1 is taken with a monk
 *     weapon, and Martial Arts' bonus strike follows it.
 *   - A row whose ability the ruleset cannot read takes a rule's better ability to hit and to damage.
 *   - Import refusals and the install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-match-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 241);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const monkWeapon = { names: ["Shortsword"], tags: ["simple", "melee"], notTags: ["two_handed", "heavy"] };
  const martialArts = {
    id: "martial-arts",
    label: "Martial Arts",
    rows: [{ list: "features", values: { name: "Martial Arts" } }],
    mechanics: {
      kind: "utility",
      attackRows: [
        {
          names: ["Unarmed Strike", "Shortsword"],
          items: { tags: ["simple", "melee"], notTags: ["two_handed", "heavy"] },
          abilities: ["str", "dex"],
          die: {
            from: { field: "level" },
            table: [
              [1, 4],
              [5, 6],
            ],
          },
          wielding: { only: monkWeapon },
        },
      ],
      grantsStrike: {
        budget: "bonus",
        names: ["Unarmed Strike"],
        afterAttack: { names: ["Unarmed Strike", "Shortsword"], items: monkWeapon },
        // Standing in for "no armor and no shield": a sheet value the fight reads.
        when: { value: { field: "hp_max" }, atMost: 100 },
        wielding: { only: monkWeapon },
      },
    },
  };
  const features = [martialArts] as unknown as RulesetCatalogEntry[];
  const unarmed = {
    name: "Unarmed Strike",
    ability: "str",
    proficient: true,
    bonus: 0,
    damage: "1",
    damage_type: "bludgeoning",
    reach: 5,
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.attacks[0].always = [structuredClone(unarmed)];
    doc.catalogs.push({ id: "monk", label: "Monk", feeds: ["features"], entries: structuredClone(features) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const block = (): RulesetStatBlock =>
    ({ health: 200, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const weapon = (name: string, dice: string, tags: string[], bonus = 0): RulesetSheetItem =>
    ({
      name,
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        tags,
        attack: {
          budget: "action",
          toHit: { abilities: ["str"], bonus },
          damage: { dice, abilities: ["str"], type: "bludgeoning", bonus },
        },
      } as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const club = () => weapon("Club +1", "1d4", ["simple", "melee", "light"], 1);
  const greatclub = () => weapon("Greatclub", "1d8", ["simple", "melee", "two_handed"]);
  const fight = (
    options: { monk?: boolean; rows?: unknown[]; items?: RulesetSheetItem[]; fields?: Record<string, number> } = {},
  ): RulesetEncounterState => {
    const monk = options.monk ?? true;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level: 5, ac: 15, speed: 40, hp_max: 40, ...options.fields },
            lists: {
              attacks: options.rows ?? [],
              features: monk
                ? features.flatMap((entry) =>
                    rowsFromCatalogEntry("monk", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
                  )
                : [],
            },
          }),
          live: {},
          catalogs: { monk: features },
          ...(options.items ? { items: options.items } : {}),
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    return state;
  };
  const who = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;
  const attack = (state: RulesetEncounterState, label: string) => {
    const found = who(state).actions.filter((one) => one.label === label && one.kind === "attack");
    assert.equal(found.length, 1, `one ${label}: ${who(state).actions.map((one) => one.label)}`);
    return found[0]!;
  };
  const shape = (action: ReturnType<typeof attack>) => [
    action.ability,
    action.toHit,
    action.damage!.count,
    action.damage!.sides,
    action.damage!.flat,
  ];

  // ── Every sheet strikes unarmed: 1 + Strength, proficient ──
  {
    const plain = fight({ monk: false });
    assert.deepEqual(shape(attack(plain, "Unarmed Strike")), ["str", 1 + 3, 0, 0, 1 + 1]);
    // A row of the same name on the sheet is used in its place.
    const own = fight({ monk: false, rows: [{ ...unarmed, bonus: 2 }] });
    assert.equal(attack(own, "Unarmed Strike").toHit, 1 + 3 + 2);
  }

  // ── A monk: the row every sheet has takes Martial Arts' Dexterity and die ──
  {
    const state = fight();
    assert.deepEqual(shape(attack(state, "Unarmed Strike")), ["dex", 3 + 3, 1, 6, 3]);
    assert.deepEqual(who(state).strikeGrants, [
      {
        budget: "bonus",
        names: ["Unarmed Strike"],
        afterAttack: { names: ["Unarmed Strike", "Shortsword"], items: monkWeapon },
      },
    ]);
  }

  // ── A held club +1 is a monk weapon by its tags: Dexterity, and the d6 over its d4 ──
  {
    const state = fight({ items: [club()] });
    assert.deepEqual(shape(attack(state, "Club +1")), ["dex", 3 + 1, 1, 6, 3 + 1]);
    assert.equal(attack(state, "Unarmed Strike").ability, "dex", "wielding only monk weapons");
    assert.ok(who(state).strikeGrants?.length);
  }

  // ── A greatclub is not: it stays as it is, and while it is held nothing of Martial Arts holds ──
  {
    const state = fight({ items: [club(), greatclub()] });
    assert.deepEqual(shape(attack(state, "Greatclub")), ["str", 1, 1, 8, 1]);
    assert.deepEqual(shape(attack(state, "Club +1")), ["str", 1 + 1, 1, 4, 1 + 1]);
    assert.deepEqual(shape(attack(state, "Unarmed Strike")), ["str", 1 + 3, 0, 0, 1 + 1]);
    assert.equal(who(state).strikeGrants, undefined);
    // Carried rather than held, it changes nothing.
    const carried = fight({ items: [club(), { ...greatclub(), worn: false }] });
    assert.equal(attack(carried, "Unarmed Strike").ability, "dex");
  }

  // ── A shortsword is a monk weapon by its name, whatever its tags ──
  {
    const state = fight({ items: [weapon("Shortsword", "1d6", ["martial", "melee", "finesse"])] });
    assert.equal(attack(state, "Shortsword").ability, "dex");
    assert.equal(attack(state, "Unarmed Strike").ability, "dex", "wielding only monk weapons");
  }

  // ── A row whose ability its ruleset cannot read (a card from a later version) takes Martial Arts'
  //    Dexterity to hit and to damage alike (laptop playtest 2026-10-24: a shortsword +7, 1d6) ──
  {
    const state = fight({ rows: [{ ...unarmed, name: "Shortsword", ability: "finesse", damage: "1d6" }] });
    assert.deepEqual(shape(attack(state, "Shortsword")), ["dex", 3 + 3, 1, 6, 3]);
  }

  // ── The attack action with a club +1 is with a monk weapon: the bonus unarmed strike follows ──
  {
    const strike = (state: RulesetEncounterState, label: string) => {
      const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label)!;
      assert.ok(option, label);
      return applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: option.id, targetIds: ["foe"] },
        roll,
      ).state;
    };
    const bonus = (state: RulesetEncounterState) =>
      rulesetCombatOptions(definition, state, "hero").some(
        (one) => one.label === "Unarmed Strike" && one.budget === "bonus",
      );
    const start = () => {
      const state = fight({ items: [club()], rows: [{ ...unarmed, name: "Greatsword", damage: "2d6" }] });
      state.order = ["hero", "foe"];
      state.turn = 0;
      return state;
    };
    assert.ok(bonus(strike(start(), "Club +1")), "after a club +1");
    assert.ok(!bonus(strike(start(), "Greatsword")), "not after a greatsword");
  }

  // ── Outside its `when`, no bonus strike; the rows still change ──
  {
    const armored = fight({ fields: { hp_max: 200 } });
    assert.equal(who(armored).strikeGrants, undefined);
    assert.equal(attack(armored, "Unarmed Strike").ability, "dex");
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].mechanics;
    refused((doc) => (doc.combat.attacks[0].always[0].weight = 2), /Unknown column "weight"/);
    refused((doc) => delete doc.combat.attacks[0].always[0].name, /is named/);
    refused((doc) => {
      delete entry(doc).attackRows[0].names;
      delete entry(doc).attackRows[0].items;
    }, /names the attacks it changes/);
    refused((doc) => (entry(doc).attackRows[0].items = {}), /item match/);
    refused((doc) => (entry(doc).grantsStrike.when.value = { field: "nope" }), /nope/);
    refused((doc) => (entry(doc).grantsStrike.wielding = { only: {} }), /item match/);
    refused((doc) => (entry(doc).grantsStrike.afterAttack = {}), /"afterAttack" names "names", "items" or both/);
  }

  // ── The install gate ──
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
    const gate =
      "A ruleset with attack lists that give every sheet a row, entries that change held weapons' attacks, or rules kept only while wielding certain weapons or granted strikes kept within bounds, requires schemaVersion 2 and capabilityApi 1.244 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const mechanics of [
      { attackRows: [{ items: { tags: ["simple"] }, qualities: ["magical"] }] },
      { attackRows: [{ names: ["Club"], wielding: { only: { tags: ["simple"] } }, qualities: ["magical"] }] },
      { grantsStrike: { budget: "bonus", when: { value: { field: "level" }, atLeast: 1 } } },
      { grantsStrike: { budget: "bonus", wielding: { only: { tags: ["simple"] } } } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: { mechanics } };
      assert.equal(issue(243, document), gate, JSON.stringify(mechanics));
      assert.notEqual(issue(244, document), gate);
    }
    const always = structuredClone(without);
    always.combat.attacks[0].always = [unarmed];
    assert.equal(issue(243, always), gate);
    assert.notEqual(issue(244, always), gate);
    assert.notEqual(issue(243, without), gate);
    const later =
      "A ruleset with entries or grants that come after the attack action taken with weapons matched by tags requires schemaVersion 2 and capabilityApi 1.246 or newer";
    const older = structuredClone(martialArts);
    older.mechanics.grantsStrike.afterAttack = { names: ["Unarmed Strike", "Shortsword"] } as never;
    assert.equal(issue(243, without, new Map([["monk.json", { entries: [older] }]])), gate);
    assert.equal(issue(245, without, new Map([["monk.json", { entries: [martialArts] }]])), later);

    for (const mechanics of [
      { afterAttack: { items: { tags: ["simple"] } } },
      { grantsStrike: { budget: "bonus", afterAttack: { names: ["Club"], items: { tags: ["simple"] } } } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: { mechanics } };
      assert.equal(issue(245, document), later, JSON.stringify(mechanics));
      assert.notEqual(issue(246, document), later);
    }
    assert.notEqual(issue(245, without), later);
  }

  console.log(
    "Ruleset weapon match: every sheet strikes unarmed, Martial Arts reaches held monk weapons by tag and holds only while wielding monk weapons, and its bonus strike keeps to its bounds and follows an attack with a magic monk weapon; gated at 1.244 and 1.246.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
