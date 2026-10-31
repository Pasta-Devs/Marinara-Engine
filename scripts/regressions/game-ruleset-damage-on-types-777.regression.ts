/** Damage changes by the blow's damage type, and spent once they add (Capability API 1.792): 5e's oil,
 *  5 more fire damage taken only from a blow that deals fire, and only once. */
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
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-damage-on-types-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetEffectWorth } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const fiveE = read("../../docs/development/ruleset-5e-2014.example.json");
  const modifiers: Record<string, any> = {
    oiled: {
      to: "damage-taken",
      flat: 5,
      damageType: "fire",
      onTypes: ["fire"],
      spentOnUse: true,
      alsoUnrolled: true,
    },
    // The old shape, every later hit: what the oil did before.
    soaked: { to: "damage-taken", flat: 5, damageType: "fire", alsoUnrolled: true },
    kindled: { to: "damage", flat: 2, onTypes: ["FIRE"], attacks: "any" },
    spark: { to: "damage", flat: 3, attacks: "any", spentOnUse: true },
  };
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    spell("bolt", { kind: "attack", attackRoll: true, amount: { flat: 8 }, damageType: "fire" }),
    spell("frost", { kind: "attack", attackRoll: true, amount: { flat: 8 }, damageType: "cold" }),
    spell("burst", {
      kind: "attack",
      amount: { flat: 8 },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
    }),
    ...["oiled", "soaked"].map((id) =>
      spell(id, { kind: "debuff", autoHit: true, applies: [{ condition: id, duration: { rounds: 10 } }] }),
    ),
  ];
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    for (const [id, modifier] of Object.entries(modifiers)) {
      doc.sheet.live.conditions.push({ id, label: id });
      doc.combat.conditions.push({ condition: id, modifiers: [structuredClone(modifier)] });
    }
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
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
    abilities: { str: 18, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100, spellcasting_ability: "int" },
    lists: {
      attacks: [{ name: "Sword", ability: "str", proficient: true, damage: "1d8", damage_type: "slashing", reach: 5 }],
      spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
    },
  });
  const fight = (condition?: string) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: { conditions: condition ? [condition] : [] },
          catalogs: { spells },
        },
        {
          id: "target",
          name: "Target",
          side: "enemy",
          block: {
            health: 100,
            defense: 12,
            initiativeModifier: 0,
            saves: { dex_save: 0 },
            actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 5, damage: { flat: 8 } }],
          },
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id = "hero") => rulesetCombatant(state, id)!;
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `script exhausted at d${sides}`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides, `${face} is a d${sides} face`);
      return face;
    };
  };
  const use = (state: RulesetEncounterState, label: string, faces: number[]) => {
    who(state).budgets.action = 1;
    state.turn = state.order.indexOf("hero");
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "hero").map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["target"] },
      dice(...faces),
    );
    assert.deepEqual(
      step.events.filter((one) => one.type === "refused"),
      [],
      JSON.stringify(step.events),
    );
    return step;
  };
  const dealt = (events: RulesetCombatEvent[]) =>
    events.reduce((total, one) => total + (one.type === "damage" ? one.dealt : 0), 0);
  const hit = (state: RulesetEncounterState, label: string, faces: number[]) => {
    const step = use(state, label, faces);
    return { state: step.state, dealt: dealt(step.events) };
  };
  const holds = (state: RulesetEncounterState, condition: string, id = "target") =>
    who(state, id).tracked.some((one) => one.condition === condition);

  // Oil: a slashing blow leaves it be, the first fire burns it and spends it, the next fire is plain.
  let oiled = use(fight(), "oiled", []).state;
  assert.ok(holds(oiled, "oiled"));
  let blow = hit(oiled, "Sword", [10, 4]);
  assert.equal(blow.dealt, 8, "a sword does not light the oil");
  assert.ok(holds(blow.state, "oiled"), "nor spend it");
  blow = hit(blow.state, "frost", [10]);
  assert.equal(blow.dealt, 8, "nor does cold");
  blow = hit(blow.state, "bolt", [10]);
  assert.equal(blow.dealt, 13, "fire lights it: 5 more fire");
  assert.ok(!holds(blow.state, "oiled"), "and it is spent");
  assert.equal(hit(blow.state, "bolt", [10]).dealt, 8, "the next fire is plain");
  // A fire clause on another blow counts too, and a fire save that halves leaves the oil's 5 whole.
  oiled = use(fight(), "oiled", []).state;
  who(oiled).actions.find((one) => one.label === "Sword")!.damage!.plus = [
    { count: 0, sides: 0, flat: 2, type: "fire" },
  ];
  assert.equal(hit(oiled, "Sword", [10, 4]).dealt, 15, "a sword with a fire clause lights it");
  assert.equal(hit(use(fight(), "oiled", []).state, "burst", [20]).dealt, 9, "saved: half the burst, all the oil");
  // The old shape adds to every later hit, whatever it deals, and is never spent.
  const soaked = use(fight(), "soaked", []).state;
  blow = hit(soaked, "Sword", [10, 4]);
  assert.equal(blow.dealt, 13);
  assert.equal(hit(blow.state, "Sword", [10, 4]).dealt, 13);

  // On the holder's own damage: only fire blows, case-insensitively, and the menu says so.
  assert.equal(hit(fight("kindled"), "bolt", [10]).dealt, 10, "a fire blow gets 2 more");
  assert.equal(hit(fight("kindled"), "Sword", [10, 4]).dealt, 8, "a sword does not");
  const average = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label)?.forecast?.averageDamage;
  assert.equal(average(fight("kindled"), "bolt"), 10);
  assert.equal(average(fight("kindled"), "Sword"), 8.5);
  // Spent the first time it adds only where it was put on: one the sheet itself holds stays, as a held
  // back change's does.
  blow = hit(fight("spark"), "Sword", [10, 4]);
  assert.equal(blow.dealt, 11);
  assert.equal(hit(blow.state, "Sword", [10, 4]).dealt, 11, "the sheet's own spark stays");

  // The fight AI counts the oil only while somebody against its holder deals fire, and a spent one at
  // half the old shape's worth.
  const combat = definition.combat!;
  const worth = (state: RulesetEncounterState, condition: string) =>
    rulesetEffectWorth(
      definition,
      combat,
      state,
      who(state),
      who(state).actions.find((one) => one.label === condition),
      who(state, "target"),
    ) ?? 0;
  const withFire = fight();
  const noFire = fight();
  for (const action of who(noFire).actions) {
    if (action.damage?.type === "fire") action.damage.type = "cold";
  }
  assert.ok(worth(withFire, "oiled") > 0, "oil is worth something against a side with fire");
  assert.equal(worth(noFire, "oiled"), 0, "and nothing without it");
  assert.ok(worth(withFire, "oiled") < worth(withFire, "soaked"), "spent once, it is worth less");

  // Only damage changes take them.
  for (const key of ["onTypes", "spentOnUse"]) {
    const result = parseRulesetDefinition(
      document((doc) => {
        doc.combat.conditions.push({
          condition: "oiled",
          modifiers: [{ to: "defense", flat: 1, [key]: key === "onTypes" ? ["fire"] : true }],
        });
      }),
    );
    assert.ok(!result.ok, `${key} on defense is refused`);
  }

  // The gate.
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "damage-on-types",
    name: "Damage on types",
    version: "0.1.0",
    description: "Damage on types",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose damage changes count only on some damage types (onTypes) or are spent once they add (spentOnUse) requires schemaVersion 2 and capabilityApi 1.792 or newer";
  for (const id of ["oiled", "kindled", "spark"]) {
    const doc = JSON.parse(fiveE);
    doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push({ condition: id, modifiers: [structuredClone(modifiers[id])] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(791) as any, doc), gate, id);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(792) as any, doc), gate, id);
  }
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(791) as any, JSON.parse(fiveE)), gate);
  console.info(
    "Damage on types (1.792): oil burns only on fire, once; a fire clause and a halved save count; own damage by type with its forecast; spent once; the AI's worth; the gate.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
