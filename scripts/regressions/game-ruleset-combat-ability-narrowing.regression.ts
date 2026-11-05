/**
 * More conditions, and changes narrowed to an ability (Capability API 1.188).
 *
 *   - A sheet's conditions, a rest's cleared ones and the fight's own hold up to 640 (320 before 1.552, 160 before 1.269, 80 before that).
 *   - A change to attacks may name `ability`: a gold dragon's Weakening Breath takes from Strength
 *     attacks and not from a bow, in the roll, its mode and the forecast.
 *   - A change to checks may name `abilities`: Rage's advantage on Strength checks reaches a grapple
 *     (Athletics), an item's Strength gate and a Strength check out of a fight, and nothing else.
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  rulesetCheckAbility,
  rulesetCheckEffects,
  rulesetCheckSources,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ability-narrowing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 183);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const narrowed: Record<string, unknown[]> = {
    weakened: [{ to: "attacks", flat: -20, ability: "str" }],
    shaky: [{ to: "attacks", mode: "disadvantage", ability: "dex" }],
    raging: [{ to: "checks", mode: "advantage", abilities: ["str"] }],
    nimble: [{ to: "checks", mode: "advantage", abilities: ["dex"] }],
    mighty: [{ to: "checks", flat: 20, abilities: ["str"] }],
    keen: [{ to: "checks", flat: 20, abilities: ["dex", "wis"] }],
  };
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    for (const [id, modifiers] of Object.entries(narrowed)) {
      doc.sheet.live.conditions.push({ id, label: id[0]!.toUpperCase() + id.slice(1) });
      doc.combat.conditions.push({ condition: id, modifiers });
    }
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const item = (name: string, body: Record<string, unknown>) =>
    ({
      name,
      quantity: 1,
      worn: true,
      item: { category: "gear", slots: { hands: 1 }, ...body } as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const weapon = (name: string, ability: string) =>
    item(name, {
      attack: {
        budget: "action",
        toHit: { abilities: [ability] },
        damage: { dice: "1d8", abilities: [ability], type: "slashing" },
      },
    });
  const axe = weapon("Axe", "str");
  const bow = weapon("Bow", "dex");
  const tome = (check: { ability: string } | { skill: string }) =>
    item("Tome", {
      use: {
        kind: "heal",
        budget: "action",
        targets: "self",
        amount: { flat: 1 },
        gate: { check, difficulty: 25 },
      },
    });

  let d20 = 10;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (
    conditions: string[],
    items: RulesetSheetItem[] = [axe, bow],
    foe: { conditions?: string[]; checks?: Record<string, number> } = {},
  ) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: { conditions }, items },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 200,
            defense: 10,
            initiativeModifier: -20,
            checks: foe.checks ?? { might: 0, agility: 0 },
            actions: [
              { id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } },
            ],
          } as RulesetStatBlock,
        },
      ],
    });
    for (const condition of foe.conditions ?? []) {
      rulesetCombatant(state, "foe")!.tracked.push({ condition, source: "foe", rounds: null });
    }
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const act = (state: RulesetEncounterState, label: string, target = "foe") =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, label).id, targetIds: [target] },
      roller,
    ).events;
  const attackOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "attack");
    assert.ok(event && event.type === "attack");
    return event;
  };

  // ── Up to 640 conditions, on the sheet, in a rest and in the fight ──
  {
    const many = (count: number) =>
      document((doc) => {
        const ids = Array.from({ length: count - doc.sheet.live.conditions.length }, (_, index) => `extra_${index}`);
        for (const id of ids) {
          doc.sheet.live.conditions.push({ id, label: id });
          doc.combat.conditions.push({ condition: id, effects: ["own-attacks-disadvantage"] });
        }
        doc.rests[0].clear = { conditions: doc.sheet.live.conditions.map((one: { id: string }) => one.id) };
      });
    const wide = parse(many(640));
    assert.equal(wide.sheet.live.conditions.length, 640);
    assert.equal(wide.combat!.conditions!.length, 639, "5e's 14, the six above, and one for each added");
    const clear = wide.rests[0]!.clear.conditions;
    assert.ok(Array.isArray(clear) && clear.length === 640);
    refused(many(641), /live\.conditions/);
    refused(
      document((doc) => {
        for (let index = 0; index < 641 - doc.combat.conditions.length; index++) {
          doc.combat.conditions.push({ condition: "poisoned", effects: [] });
        }
      }),
      /combat\.conditions/,
    );
    // A character holds as many as the sheet declares.
    const all = wide.sheet.live.conditions.map((one) => one.id);
    const sources = rulesetCheckSources(wide, build, { conditions: all });
    assert.ok(
      sources.some((source) => source.name === all[639]),
      "the 640th condition is still held",
    );
  }

  // ── Weakening Breath: Strength attacks only ──
  {
    assert.equal(attackOf(act(fight([]), "Axe")).outcome, "hit");
    const weak = attackOf(act(fight(["weakened"]), "Axe"));
    assert.equal(weak.outcome, "miss", "the axe is swung with Strength");
    assert.ok(weak.bonuses?.some((bonus) => bonus.condition === "weakened" && bonus.value === -20));
    const shot = attackOf(act(fight(["weakened"]), "Bow"));
    assert.equal(shot.outcome, "hit", "the bow is drawn with Dexterity");
    assert.equal(shot.bonuses, undefined, "and nothing is said about it");
    const chance = (conditions: string[], label: string) => optionOf(fight(conditions), label).forecast?.hitChance ?? 0;
    assert.ok(chance(["weakened"], "Axe") < chance([], "Axe"), "the forecast knows the axe is weaker");
    assert.equal(chance(["weakened"], "Bow"), chance([], "Bow"), "and the bow is not");
    // Rolled twice: a shaky hand on the bow only.
    assert.equal(attackOf(act(fight(["shaky"]), "Bow")).mode, "disadvantage");
    assert.equal(attackOf(act(fight(["shaky"]), "Axe")).mode, "normal");
    assert.ok(chance(["shaky"], "Bow") < chance([], "Bow"));
    assert.equal(chance(["shaky"], "Axe"), chance([], "Axe"));
  }

  // ── Rage: Strength checks, a grapple's Athletics included ──
  {
    const grapple = (conditions: string[], foe: Parameters<typeof fight>[2] = {}) => {
      const event = act(fight(conditions, [axe, bow], foe), "Grapple").find((one) => one.type === "contest");
      assert.ok(event && event.type === "contest");
      return event;
    };
    assert.equal(grapple([]).attacker.mode ?? "normal", "normal");
    const raging = grapple(["raging"]).attacker;
    assert.equal(raging.mode, "advantage", "Athletics is Strength");
    assert.equal(raging.rolls.length, 2);
    assert.equal(grapple(["nimble"]).attacker.mode ?? "normal", "normal", "a Dexterity edge does not grapple");
    assert.ok(grapple(["mighty"]).attacker.bonuses?.length, "a Strength bonus counts");
    assert.equal(grapple(["keen"]).attacker.bonuses, undefined, "a Dexterity one does not");
    // The defender throws its own check with its own edges.
    const strong = grapple([], { conditions: ["mighty"], checks: { might: 5, agility: 0 } }).defender;
    assert.equal(strong.check, "might");
    assert.ok(strong.bonuses?.length, "a defender's Athletics is Strength");
    const quick = grapple([], { conditions: ["mighty"], checks: { might: 0, agility: 5 } }).defender;
    assert.equal(quick.check, "agility");
    assert.equal(quick.bonuses, undefined, "its Acrobatics is not");
    const odds = (conditions: string[]) => optionOf(fight(conditions), "Grapple").forecast?.hitChance ?? 0;
    assert.ok(odds(["raging"]) > odds([]), "the forecast knows Rage");
    assert.ok(odds(["mighty"]) > odds([]));
    assert.equal(odds(["nimble"]), odds([]));
    assert.equal(odds(["keen"]), odds([]));
  }

  // ── An item's gate is rolled with its ability ──
  {
    const gate = (conditions: string[], ability: string, skill?: string) => {
      const event = act(fight(conditions, [tome(skill ? { skill } : { ability })]), "Tome", "hero").find(
        (one) => one.type === "gate",
      );
      assert.ok(event && event.type === "gate");
      return event;
    };
    assert.equal(gate([], "str").success, false);
    assert.equal(gate(["mighty"], "str").success, true, "Strength, so the bonus counts");
    assert.equal(gate(["mighty"], "dex").success, false, "Dexterity, so it does not");
    assert.equal(gate(["raging"], "str").mode, "advantage");
    assert.equal(gate(["raging"], "dex").mode ?? "normal", "normal");
    // A skill's gate is rolled with the skill's ability.
    assert.equal(gate(["raging"], "", "athletics").mode, "advantage", "Athletics is Strength");
    assert.equal(gate(["raging"], "", "acrobatics").mode ?? "normal", "normal", "Acrobatics is not");
    assert.equal(gate(["mighty"], "", "athletics").success, true);
  }

  // ── What a check is made with ──
  {
    const checked = parse(
      document((doc) => {
        doc.combat.checks.push({ id: "brawn", label: "Brawn", value: { abilityMod: "str" } });
      }),
    );
    assert.equal(rulesetCheckAbility(checked, "str"), "str", "an ability by its own id");
    assert.equal(rulesetCheckAbility(checked, "athletics"), "str", "a skill by its ability");
    assert.equal(rulesetCheckAbility(checked, "brawn"), "str", "a fight's check off an ability");
    assert.equal(rulesetCheckAbility(checked, "agility"), "dex", "a fight's check off a skill");
    assert.equal(rulesetCheckAbility(checked, undefined), undefined);
    assert.equal(rulesetCheckAbility(checked, "nothing"), undefined);
  }

  // ── Out of a fight ──
  {
    const effects = (conditions: string[], name: string) =>
      rulesetCheckEffects(
        rulesetCheckSources(definition, build, { conditions }),
        matchRulesetCheckTarget(definition, name),
      );
    assert.deepEqual(effects(["raging"], "Athletics").advantage, ["Raging"]);
    assert.deepEqual(effects(["raging"], "Strength").advantage, ["Raging"]);
    assert.deepEqual(effects(["raging"], "Stealth").advantage, []);
    assert.deepEqual(effects(["raging"], "Dexterity").advantage, []);
    assert.equal(effects(["keen"], "Perception").modifiers.length, 1, "Wisdom");
    assert.equal(effects(["keen"], "Athletics").modifiers.length, 0);
    assert.deepEqual(effects(["raging"], "Strength saving throw").advantage, [], "a save is no check");
  }

  // ── Refusals ──
  {
    const condition = (modifier: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.conditions.push({ condition: "poisoned", modifiers: [modifier] });
      });
    refused(condition({ to: "saves", flat: 1, ability: "str" }), /"ability" narrows damage or attacks only/);
    refused(condition({ to: "attacks", flat: 1, abilities: ["str"] }), /"abilities" narrows a change to checks/);
    refused(condition({ to: "checks", flat: 1, abilities: ["luck"] }), /Unknown ability "luck"/);
    refused(condition({ to: "attacks", flat: 1, ability: "luck" }), /Unknown ability "luck"/);
    refused(condition({ to: "checks", flat: 1, abilities: [] }), /abilities/);
  }

  // ── The gate ──
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
      "A ruleset with more than 80 conditions, attacks narrowed by the ability they're made with, or checks narrowed by ability requires schemaVersion 2 and capabilityApi 1.188 or newer";
    const only = (id: string) => {
      const doc = JSON.parse(fiveE);
      doc.combat.conditions.push({ condition: "poisoned", modifiers: narrowed[id] });
      return doc;
    };
    const wide = (() => {
      const doc = JSON.parse(fiveE);
      for (let index = doc.sheet.live.conditions.length; index < 81; index++) {
        doc.sheet.live.conditions.push({ id: `extra_${index}`, label: `extra ${index}` });
      }
      return doc;
    })();
    for (const [label, doc] of [
      ["attacks by ability", only("weakened")],
      ["attack mode by ability", only("shaky")],
      ["checks by abilities", only("raging")],
      ["81 conditions", wide],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(187) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(188) as never, doc), gate, label);
    }
    // Damage was narrowed by ability long before.
    const damage = JSON.parse(fiveE);
    damage.combat.conditions.push({ condition: "poisoned", modifiers: [{ to: "damage", flat: 2, ability: "str" }] });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(187) as never, damage), gate, "damage by ability");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(187) as never, JSON.parse(fiveE)), gate, "plain 5e");
    // More than 320 (1.552).
    const gate536 = "A ruleset with more than 320 conditions requires schemaVersion 2 and capabilityApi 1.552 or newer";
    const wider = (count: number) => {
      const doc = JSON.parse(fiveE);
      for (let index = doc.sheet.live.conditions.length; index < count; index++) {
        doc.sheet.live.conditions.push({ id: `extra_${index}`, label: `extra ${index}` });
      }
      return doc;
    };
    assert.equal(getCapabilityPackageInstallIssue(manifest(551) as never, wider(321)), gate536, "321 conditions");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(552) as never, wider(321)), gate536, "321 at 1.552");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(551) as never, wider(320)), gate536, "320 before");
  }

  console.log(
    "Ruleset ability narrowing: 640 conditions fit, Weakening Breath weakens Strength attacks only, and Rage leans Strength checks, grapples and gates, in and out of a fight.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
