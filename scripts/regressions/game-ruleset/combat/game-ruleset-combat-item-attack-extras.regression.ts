/** A weapon's extra damage and saves on what its hit puts on (Capability API 1.169): a javelin of
 *  lightning, a dragon slayer, a sword of sharpness and a sword of wounding. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetAverageDamage,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetItemAttackText,
  rulesetItemFacts,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-attack-extras-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 164);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const weapon = (name: string, extras: Record<string, unknown>): RulesetSheetItem => ({
    name,
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
        ...extras,
      },
    } as RulesetCatalogItem,
  });
  const javelin = weapon("Javelin", { plus: [{ dice: "4d6", type: "lightning" }] });
  const slayer = weapon("Slayer", { plus: [{ dice: "3d6", type: "slashing", targetIs: { types: ["dragon"] } }] });
  const sharp = weapon("Sharp", { plus: [{ flat: 14, type: "slashing", when: "critical" }] });
  const wounding = weapon("Wounding", {
    onHit: [{ condition: "wounded", atLeast: 1, saveEnds: { save: "con_save", difficulty: 15, at: "turn-start" } }],
  });
  const dazing = (difficulty: number) =>
    weapon("Dazing", { onHit: [{ condition: "dazed", atLeast: 1, save: { save: "con_save", difficulty } }] });
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.combat.creatureTypes = {
      types: [
        { id: "beast", label: "Beast" },
        { id: "dragon", label: "Dragon" },
      ],
    };
    for (const id of ["wounded", "dazed"])
      doc.sheet.live.conditions.push({ id, label: id[0]!.toUpperCase() + id.slice(1) });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const creature = (id: string, type: string) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: -20,
      type,
      saves: { con_save: 0 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    },
  });
  const fight = (items: RulesetSheetItem[]) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items },
        creature("wolf", "beast"),
        creature("wyrm", "dragon"),
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "hero").map((one) => one.label)}`);
    return option;
  };
  // Every d20 shows `d20`, every other die a 2.
  const strike = (items: RulesetSheetItem[], label: string, target: string, d20 = 10) => {
    const state = fight(items);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, label).id, targetIds: [target] },
      (sides) => (sides === 20 ? d20 : 2),
    );
  };
  const dealt = (events: RulesetCombatEvent[], target: string) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .filter((one) => one.targetId === target)
      .reduce((total, one) => total + one.dealt, 0);

  // Extra damage on every hit, typed on its own.
  {
    const events = strike([javelin], "Javelin", "wolf").events;
    assert.equal(dealt(events, "wolf"), 2 + 4 + 8, "1d8+4 and 4d6 lightning");
    assert.ok(
      events.some((one) => one.type === "damage" && one.damageType === "lightning"),
      "the clause is its own lightning damage",
    );
    assert.equal(
      optionOf(fight([javelin]), "Javelin").forecast?.averageDamage,
      4.5 + 4 + 14,
      "and the forecast counts it",
    );
    assert.equal(dealt(strike([javelin], "Javelin", "wolf", 1).events, "wolf"), 0, "a miss deals none of it");
  }

  // Only against what it names.
  {
    assert.equal(dealt(strike([slayer], "Slayer", "wolf").events, "wolf"), 6, "a beast takes the blade alone");
    assert.equal(dealt(strike([slayer], "Slayer", "wyrm").events, "wyrm"), 12, "a dragon takes 3d6 more");
  }

  // Only on a critical hit.
  {
    assert.equal(dealt(strike([sharp], "Sharp", "wolf").events, "wolf"), 6, "an ordinary hit");
    assert.equal(dealt(strike([sharp], "Sharp", "wolf", 20).events, "wolf"), 2 + 2 + 4 + 14, "a critical adds 14");
    assert.equal(optionOf(fight([sharp]), "Sharp").forecast?.averageDamage, 8.5, "never in the forecast");
    assert.equal(
      rulesetAverageDamage({ count: 1, sides: 8, flat: 4, plus: [{ count: 0, sides: 0, flat: 14, onCritical: true }] }),
      8.5,
      "nor in a plain average",
    );
  }

  // Saves on what a hit puts on.
  {
    const wounded = strike([wounding], "Wounding", "wolf").state;
    assert.ok(rulesetCombatConditions(definition, who(wounded, "wolf")).includes("wounded"));
    const tracked = who(wounded, "wolf").tracked.find((one) => one.condition === "wounded");
    assert.deepEqual(tracked?.saveEnds, { save: "con_save", at: "turn-start" }, "lasts until a save");
    assert.equal(tracked?.difficulty, 15, "against 15");
    assert.equal(tracked?.rounds, null, "with no clock of its own");
    // The wolf's turn starts: a 14 keeps it, a 15 ends it.
    const turnOf = (state: RulesetEncounterState, face: number) => {
      let next = structuredClone(state);
      while (next.order[next.turn] !== "wolf") {
        next = advanceRulesetTurn(definition, next, (sides) => (sides === 20 ? face : 2)).state;
      }
      return next;
    };
    assert.ok(
      rulesetCombatConditions(definition, who(turnOf(wounded, 14), "wolf")).includes("wounded"),
      "a 14 keeps it",
    );
    assert.ok(
      !rulesetCombatConditions(definition, who(turnOf(wounded, 15), "wolf")).includes("wounded"),
      "a 15 ends it",
    );
    const resisted = strike([dazing(5)], "Dazing", "wolf");
    assert.ok(
      !rulesetCombatConditions(definition, who(resisted.state, "wolf")).includes("dazed"),
      "a made save keeps it off",
    );
    assert.ok(
      resisted.events.some((one) => one.type === "save"),
      "and the save is rolled",
    );
    const dazed = strike([dazing(30)], "Dazing", "wolf").state;
    assert.ok(rulesetCombatConditions(definition, who(dazed, "wolf")).includes("dazed"), "a failed one does not");
  }

  // What the item says.
  {
    const text = (item: RulesetSheetItem) => rulesetItemAttackText(rulesetItemFacts(definition, item.item!).attack!);
    assert.match(text(slayer), /\+3d6 slashing against Dragon/);
    assert.match(text(sharp), /\+14 slashing on a critical hit/);
    assert.match(
      text(wounding),
      /until a Constitution save 15 save at the start of each turn|until a .* 15 save at the start of each turn/,
    );
  }

  // Import refusals.
  {
    const refused = (attack: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        document((doc) => {
          doc.catalogs.push({
            id: "gear",
            label: "Gear",
            entries: [
              {
                id: "blade",
                label: "Blade",
                item: { category: "gear", attack: { budget: "action", damage: { dice: "1d8" }, ...attack } },
              },
            ],
          });
        }),
      );
      assert.ok(!result.ok, `must refuse ${pattern}`);
      assert.match(result.issues.join("; "), pattern);
    };
    refused({ plus: [{ type: "fire" }] }, /names dice, a flat amount, or both/);
    refused({ plus: [{ dice: "1d6", targetIs: { types: ["giant"] } }] }, /Unknown creature type "giant"/);
    refused(
      { plus: [{ dice: "1d6", save: { save: "luck", difficulty: 10, onSuccess: "half" } }] },
      /Unknown save "luck"/,
    );
    refused(
      { onHit: [{ condition: "dazed", atLeast: 1, save: { save: "luck", difficulty: 10 } }] },
      /Unknown save "luck"/,
    );
    refused(
      {
        onHit: [
          { condition: "dazed", atLeast: 1, rounds: 2, saveEnds: { save: "con_save", difficulty: 10, at: "turn-end" } },
        ],
      },
      /lasts until it is made/,
    );
  }

  // The gate.
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
      "A ruleset whose weapons deal extra damage or put on conditions a save resists requires schemaVersion 2 and capabilityApi 1.169 or newer";
    const withItem = (item: RulesetSheetItem) =>
      document((doc) => {
        delete doc.combat.creatureTypes;
        doc.catalogs.push({ id: "gear", label: "Gear", entries: [{ id: "blade", label: "Blade", item: item.item }] });
      });
    assert.equal(getCapabilityPackageInstallIssue(manifest(168) as never, withItem(javelin)), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(168) as never, withItem(wounding)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(169) as never, withItem(javelin)), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(168) as never, withItem(weapon("Plain", {}))),
      gate,
      "nothing without the keys",
    );
  }

  console.log("Item attack extras: lightning, slayer dice, a critical's 14, saves on a wound, gated at 1.169.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
