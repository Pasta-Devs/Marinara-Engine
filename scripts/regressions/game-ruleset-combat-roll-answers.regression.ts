/**
 * Answers to more kinds of roll (Capability API 1.257).
 *
 *   - `lowersRoll.also`: Cutting Words off somebody else's ability check (a contest, an item's gate,
 *     Counterspell's check) and off their damage roll, spent as the roll is made where its most could
 *     turn it: a check that would succeed, damage that would take one of its user's side down. Not on
 *     a creature that cannot hear (`needs`) or is immune to being charmed (`targetTypes`).
 *   - A rescue's `saves` and `budget`: a ring of evasion, Dexterity saves only, paid with the reaction.
 *   - `halfOnMiss` on an item's use: a scroll of Acid Arrow.
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
} from "../../packages/shared/src/index.js";
import { letAnswerThrough } from "./fixtures/ruleset-counter-pass.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-roll-answers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 252);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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

  // ── Cutting Words on a contest: only where it could turn it ──
  {
    // 10 and the +4 is 14 against 9: a d6 could make it 8, so it is spent, and its 3 leaves 11.
    const kept = grapple(fight(), 10, 9);
    const lowered = of(kept.events, "lowered");
    assert.deepEqual(lowered, [
      {
        type: "lowered",
        actorId: "bard",
        targetId: "hero",
        label: "Cutting Words",
        to: "Grapple",
        roll: "checks",
        rolls: [3],
        by: 3,
        total: 11,
      },
    ]);
    const contest = of(kept.events, "contest")[0]!;
    assert.equal(contest.attacker.total, 11);
    assert.equal(contest.winner, "actor", "11 still beats 9");
    assert.equal(counter(kept.state, "bard", "counters:inspiration"), 2);
    assert.equal(who(kept.state, "bard").budgets.reaction, 0, "the bard's reaction");
    // 8 and 4 is 12 against 10: the 3 turns it.
    const turned = grapple(fight(), 8, 10);
    assert.equal(of(turned.events, "contest")[0]!.winner, "target");
    // Far ahead: no d6 could turn it, so it is kept.
    const ahead = grapple(fight(), 20, 2);
    assert.equal(of(ahead.events, "lowered").length, 0);
    assert.equal(counter(ahead.state, "bard", "counters:inspiration"), 3);
    // Losing anyway: nothing to take off.
    assert.equal(of(grapple(fight(), 2, 20).events, "lowered").length, 0);
    // Spent once: its reaction gone, the next is not answered.
    const twice = grapple(fight(), 10, 9);
    who(twice.state).budgets.action = 1;
    assert.equal(of(grapple(twice.state, 10, 9).events, "lowered").length, 0, "no reaction left");
    // Without it, nothing.
    assert.equal(of(grapple(fight({ bard: false }), 10, 9).events, "lowered").length, 0);
    // Off attack rolls only, without `also`.
    assert.equal(of(grapple(fight({ plain: true }), 10, 9).events, "lowered").length, 0, "no also");
    // Never on its own side.
    assert.equal(of(grapple(fight({ ally: true }), 10, 9).events, "lowered").length, 0, "an ally");
    assert.equal(
      of(grapple(fight({ ally: true, anybody: true }), 10, 9).events, "lowered").length,
      0,
      "an ally, though it may point at anybody",
    );
    // Nor while it cannot answer.
    const dazed = fight();
    who(dazed, "bard").tracked.push({ condition: "incapacitated", rounds: null });
    assert.equal(of(grapple(dazed, 10, 9).events, "lowered").length, 0, "incapacitated");
  }

  // ── Not on whoever cannot hear, or is immune to being charmed ──
  {
    const deaf = fight();
    who(deaf).tracked.push({ condition: "deafened_now", rounds: null });
    assert.equal(of(grapple(deaf, 10, 9).events, "lowered").length, 0, "cannot hear");
    const blank = fight();
    who(blank).tracked.push({ condition: "mind_blank", rounds: null });
    assert.equal(of(grapple(blank, 10, 9).events, "lowered").length, 0, "immune to charmed");
  }

  // ── On an item's gate ──
  {
    const tome = {
      name: "Tome",
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        use: {
          kind: "heal",
          budget: "action",
          targets: "self",
          amount: { flat: 1 },
          gate: { check: { ability: "str" }, difficulty: 15 },
        },
      } as unknown as RulesetCatalogItem,
    } as RulesetSheetItem;
    // 12 and the +4 is 16 against 15: the 3 fails it.
    const state = fight({ items: [tome] });
    d20s = [12];
    const read = take(state, "Tome", "hero", ["hero"]);
    const gate = of(read.events, "gate")[0]!;
    assert.equal(gate.success, false);
    assert.equal(gate.total, 13);
    assert.equal(of(read.events, "lowered")[0]?.roll, "checks");
    const easy = fight({ items: [tome] });
    d20s = [20];
    assert.equal(of(take(easy, "Tome", "hero", ["hero"]).events, "lowered").length, 0, "24 is past any d6");
  }

  // ── On Counterspell's check above its reach ──
  {
    const spells = [
      {
        id: "bolt",
        label: "Bolt",
        rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          autoHit: true,
          amount: { flat: 3 },
          damageType: "fire",
          cost: [{ pool: "slots_1", amount: 1 }],
        },
      },
      {
        id: "counter",
        label: "Counter",
        rows: [{ list: "spells", values: { name: "Counter", level: 3, prepared: true } }],
        mechanics: {
          kind: "utility",
          budget: "reaction",
          cost: [{ pool: "slots_3", amount: 1 }],
          reaction: {
            on: "used",
            cancels: true,
            against: { catalogs: ["spells"] },
            upTo: "paid",
            above: { check: { abilityModFromField: "spellcasting_ability" }, dc: 10 },
          },
        },
      },
    ] as unknown as RulesetCatalogEntry[];
    const caster = (abilities: Record<string, number>, keep: string[] = []) =>
      rulesetSheetBuildSchema.parse({
        abilities: { str: 8, con: 12, wis: 12, cha: 10, ...abilities },
        fields: {
          level: 9,
          ac: 12,
          speed: 30,
          hp_max: 40,
          spellcasting_ability: "int",
          slots_max_1: 4,
          slots_max_3: 3,
          slots_max_5: 1,
        },
        lists: {
          spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
          features: rows("features", keep),
          counters: rows("counters", keep),
        },
      });
    const answered = (bard: boolean) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        bestiary: { spells, heroic: features },
        combatants: [
          {
            id: "mage",
            name: "Mage",
            side: "enemy",
            block: { sheet: caster({ dex: 20, int: 16 }), actions: [] },
          } as RulesetCombatantInput,
          {
            id: "bard",
            name: "Bard",
            side: "enemy",
            block: { sheet: caster({ dex: 1, int: 8 }, bard ? ["cutting-words"] : []), actions: [] },
          } as RulesetCombatantInput,
          {
            id: "corwin",
            name: "Corwin",
            side: "party",
            // Int 18: +4 on the check against 10 and the bolt's 5.
            build: caster({ dex: 1, int: 18 }),
            live: {},
            catalogs: { spells, heroic: features },
          },
        ],
      });
      const bolt = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Bolt")!;
      const held = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: bolt.id, targetIds: ["corwin"], payWith: "slots_5" },
        () => 10,
      );
      assert.ok(held.state.window, JSON.stringify(held.events));
      const answer = rulesetWindowOptions(definition, held.state, "corwin").find((one) => one.label === "Counter")!;
      const roller = (sides: number) => (sides === 20 ? 12 : 3);
      return letAnswerThrough(
        definition,
        applyRulesetCombatChoice(
          definition,
          held.state,
          { actorId: "corwin", optionId: answer.id, targetIds: [], window: held.state.window!.id },
          roller,
        ),
        roller,
      );
    };
    // 12 and the +4 is 16 against 15: the bard's 3 makes it 13, and the bolt lands.
    const spoiled = answered(true);
    assert.equal(of(spoiled.events, "lowered")[0]?.targetId, "corwin");
    assert.equal(of(spoiled.events, "cancelled").length, 0);
    assert.equal(of(answered(false).events, "cancelled").length, 1, "without the bard, it is stopped");
  }

  // ── On a damage roll: only where it keeps one of the bard's side standing ──
  {
    const swing = (state: RulesetEncounterState) => {
      d20s = [15];
      return take(state, "Greataxe", "hero", ["foe"]);
    };
    // The Greataxe's 3 and the +4 is 7 against 6 left: the bard's 3 makes it 4.
    const saved = swing(fight({ health: 6 }));
    const lowered = of(saved.events, "lowered")[0]!;
    assert.equal(lowered.roll, "damage");
    assert.equal(lowered.to, "Greataxe");
    assert.equal(lowered.total, 4);
    const damage = of(saved.events, "damage")[0]!;
    assert.equal(damage.dealt, 4);
    assert.equal(damage.health, 2, "still standing");
    // Plenty left: kept.
    const sturdy = swing(fight({ health: 100 }));
    assert.equal(of(sturdy.events, "lowered").length, 0);
    assert.equal(counter(sturdy.state, "bard", "counters:inspiration"), 3);
    // Too far gone for a d6 to help: kept.
    assert.equal(of(swing(fight({ health: 1 })).events, "lowered").length, 0);
  }

  // ── A ring of evasion: a failed Dexterity save made, for the reaction and a charge ──
  {
    const breathed = (state: RulesetEncounterState, label: string, ...rolls: number[]) => {
      state.turn = 2;
      who(state, "foe").budgets.action = 1;
      d20s = rolls;
      return take(state, label, "foe", ["hero"]);
    };
    const state = fight({ heroKeeps: ["ring-of-evasion"], bard: false });
    const step = breathed(state, "Breath", 5);
    assert.equal(of(step.events, "rescued")[0]?.label, "Ring of Evasion");
    assert.equal(of(step.events, "damage")[0]!.dealt, 5, "half, as a success");
    assert.equal(counter(step.state, "hero", "counters:ring charges"), 2);
    assert.equal(who(step.state).budgets.reaction, 0);
    // Its reaction spent, the next failed save stands.
    const again = breathed(step.state, "Breath", 5);
    assert.equal(of(again.events, "rescued").length, 0);
    assert.equal(of(again.events, "damage")[0]!.dealt, 10);
    // Not a Wisdom save.
    const wis = breathed(fight({ heroKeeps: ["ring-of-evasion"], bard: false }), "Glare", 5);
    assert.equal(of(wis.events, "rescued").length, 0);
  }

  // ── A scroll of Acid Arrow splashes on a miss ──
  {
    const scroll = {
      name: "Scroll of Acid Arrow",
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        use: {
          kind: "attack",
          budget: "action",
          targets: "enemy",
          range: 90,
          attackRoll: true,
          toHit: { bonus: 5 },
          halfOnMiss: true,
          amount: { dice: "4d4" },
          damageType: "acid",
        },
      } as unknown as RulesetCatalogItem,
    } as RulesetSheetItem;
    const state = fight({ items: [scroll], bard: false });
    d20s = [2];
    const missed = take(state, "Scroll of Acid Arrow", "hero", ["foe"]);
    assert.equal(of(missed.events, "attack")[0]!.outcome, "miss");
    assert.equal(of(missed.events, "damage")[0]!.dealt, 6, "half of 12");
  }

  // ── Import ──
  {
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs
        .find((one: { id: string }) => one.id === "heroic")
        .entries.find((one: { id: string }) => one.id === id);
    refused(
      fiveE((doc) => (entry(doc, "ring-of-evasion").mechanics.rescue.roll = "checks")),
      /"saves" narrows a rescue of "saves"/,
    );
    refused(
      fiveE((doc) => (entry(doc, "ring-of-evasion").mechanics.rescue.budget = "nope")),
      /Unknown budget "nope"/,
    );
    refused(
      fiveE((doc) => (entry(doc, "cutting-words").mechanics.lowersRoll.also = ["checks", "checks"])),
      /Rolls must be unique/,
    );
    const scrollDoc = (use: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.push({
          id: "scrolls",
          label: "Scrolls",
          holds: "items",
          entries: [
            {
              id: "acid",
              label: "Scroll of Acid Arrow",
              item: {
                category: "gear",
                use: { kind: "attack", budget: "action", targets: "enemy", halfOnMiss: true, ...use },
              },
            },
          ],
        });
      });
    parsed(scrollDoc({ attackRoll: true, toHit: { bonus: 5 }, amount: { dice: "4d4" } }));
    refused(scrollDoc({ amount: { dice: "4d4" } }), /"halfOnMiss" is on a use that rolls to hit/);
    refused(scrollDoc({ attackRoll: true, toHit: { bonus: 5 } }), /"halfOnMiss" is on a use that rolls to hit/);
  }

  // ── The install gate: 1.257 ──
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
      "A ruleset with answers taking dice off checks or damage, rescues narrowed to some saves or spending a budget, or item uses dealing half on a miss, requires schemaVersion 2 and capabilityApi 1.257 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { mechanics: { lowersRoll: { dice: "1d6", also: ["damage"] } } },
      { mechanics: { rescue: { roll: "saves", by: "success", saves: ["dex_save"] } } },
      { mechanics: { rescue: { roll: "saves", by: "success", budget: "reaction" } } },
      { item: { use: { halfOnMiss: true } } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(256, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(257, document), gate);
    }
    const older = structuredClone(without);
    older.extra = { entry: { mechanics: { lowersRoll: { dice: "1d6" } } } };
    assert.notEqual(issue(256, older), gate, "off an attack roll is older");
    assert.notEqual(issue(256, without), gate);
    assert.equal(issue(256, without, new Map([["heroic.json", { entries: [ring] }]])), gate);
  }

  console.log(
    "Ruleset roll answers: Cutting Words off checks and damage where it could turn them, not on the deaf or the charm-immune, a ring of evasion on Dexterity saves for the reaction, and a scroll's half on a miss; gated at 1.257.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
