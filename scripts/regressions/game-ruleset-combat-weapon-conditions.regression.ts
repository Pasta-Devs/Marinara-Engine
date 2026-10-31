/**
 * A weapon changed for a time by a condition (Capability API 1.501).
 *
 *   - Magic Weapon: every weapon +1 to hit and to damage, and magical.
 *   - Shillelagh: a quarterstaff made with the spellcasting ability, a d8, magical; a dagger is not.
 *   - Read by the roll as by the menu; a stat block's blow takes the flat numbers only.
 *   - Refusals and the install gate.
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
  rulesetCombatant,
  rulesetSheetBuildSchema,
  rulesetWeaponNow,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-conditions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 501);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const magicWeapon = { toHit: 1, damage: 1, qualities: ["magical"] };
  const shillelagh = {
    names: ["quarterstaff"],
    abilityFrom: "spellcasting_ability",
    die: 8,
    qualities: ["magical"],
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "magic_weapon", label: "Magic Weapon" },
      { id: "shillelagh", label: "Shillelagh" },
      { id: "natural_weapons", label: "Natural Weapons" },
    );
    doc.combat.conditions.push(
      { condition: "magic_weapon", effects: [], weapon: magicWeapon },
      { condition: "shillelagh", effects: [], weapon: shillelagh },
      { condition: "natural_weapons", effects: [], weapon: { names: ["unarmed", "slam"], die: 6 } },
    );
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
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const druid = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 12, int: 10, wis: 18, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "wis" },
    lists: {
      attacks: [
        { name: "Quarterstaff", ability: "str", proficient: true, bonus: 0, damage: "1d6", reach: 5 },
        { name: "Dagger", ability: "str", proficient: true, bonus: 0, damage: "1d4", reach: 5 },
        { name: "Unarmed Strike", ability: "str", proficient: true, bonus: 0, damage: "1", reach: 5 },
      ],
    },
  });
  const ogre: RulesetStatBlock = {
    health: 60,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { id: "club", name: "Club", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2 }, reach: 5 },
      { id: "slam", name: "Slam", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 5 }, reach: 5 },
    ],
  } as unknown as RulesetStatBlock;
  const fight = (held: string[], on = "druid"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "druid", name: "Druid", side: "party", build: druid, live: {} },
        { id: "ogre", name: "Ogre", side: "enemy", block: ogre },
      ],
      board: {
        grid: { width: 6, height: 1, tiles: [Array(6).fill("plains")] } as never,
        placements: { druid: { x: 1, y: 0 }, ogre: { x: 2, y: 0 } },
      },
    });
    state.order = ["druid", "ogre"];
    state.turn = on === "druid" ? 0 : 1;
    for (const condition of held) rulesetCombatant(state, on)!.tracked.push({ condition, rounds: 10 });
    return state;
  };
  const now = (state: RulesetEncounterState, label: string, who = "druid") => {
    const actor = rulesetCombatant(state, who)!;
    const action = actor.actions.find((one) => one.label === label)!;
    assert.ok(action, `${label}: ${actor.actions.map((one) => one.label)}`);
    return rulesetWeaponNow(definition, state, actor, action);
  };

  // ── Without either: Strength, +2 proficiency ──
  {
    const staff = now(fight([]), "Quarterstaff");
    assert.equal(staff.toHit, 5);
    assert.deepEqual([staff.damage!.count, staff.damage!.sides, staff.damage!.flat], [1, 6, 3]);
    assert.equal(staff.damageAddsAbility, true);
  }

  // ── Magic Weapon: every weapon +1 and magical ──
  {
    const state = fight(["magic_weapon"]);
    for (const label of ["Quarterstaff", "Dagger"]) {
      const blow = now(state, label);
      assert.equal(blow.toHit, 6, label);
      assert.equal(blow.damage!.flat, 4, label);
      assert.ok(blow.damage!.qualities?.includes("magical"), label);
    }
    // The fighter's own action is untouched: the change is read, not written.
    assert.equal(rulesetCombatant(state, "druid")!.actions.find((one) => one.label === "Dagger")!.toHit, 5);
  }

  // ── Shillelagh: the quarterstaff by Wisdom with a d8; the dagger as it was ──
  {
    const state = fight(["shillelagh"]);
    const staff = now(state, "Quarterstaff");
    assert.equal(staff.toHit, 6, "4 + 2");
    assert.equal(staff.ability, "wis");
    assert.deepEqual([staff.damage!.count, staff.damage!.sides, staff.damage!.flat], [1, 8, 4]);
    assert.ok(staff.damage!.qualities?.includes("magical"));
    const dagger = now(state, "Dagger");
    assert.equal(dagger.toHit, 5);
    assert.equal(dagger.damage!.sides, 4);
    // Both: Wisdom, a d8, and +1.
    const both = now(fight(["shillelagh", "magic_weapon"]), "Quarterstaff");
    assert.deepEqual([both.toHit, both.damage!.sides, both.damage!.flat], [7, 8, 5]);
  }

  // ── The roll reads it ──
  {
    const state = fight(["shillelagh"]);
    const staff = rulesetCombatant(state, "druid")!.actions.find((one) => one.label === "Quarterstaff")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "druid", optionId: staff.id, targetIds: ["ogre"] },
      () => 3,
    );
    const attack = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    )!;
    assert.equal(attack.total, 9, JSON.stringify(step.events));
    const damage = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage",
    );
    assert.equal(damage, undefined, "3 + 6 misses defense 10");
    const hit = applyRulesetCombatChoice(
      definition,
      fight(["shillelagh"]),
      { actorId: "druid", optionId: staff.id, targetIds: ["ogre"] },
      () => 5,
    );
    const dealt = hit.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage",
    )!;
    assert.equal(dealt.amount, 9, "a 5 on the d8 and Wisdom's 4");
  }

  // ── A named blow of flat damage rolls the die instead (1.654): Alter Self's unarmed strikes ──
  {
    const fist = now(fight([]), "Unarmed Strike");
    assert.deepEqual([fist.damage!.count, fist.damage!.flat], [0, 4], "1 plus Strength");
    const natural = now(fight(["natural_weapons"]), "Unarmed Strike");
    assert.deepEqual(
      [natural.damage!.count, natural.damage!.sides, natural.damage!.flat],
      [1, 6, 3],
      "a d6 plus Strength",
    );
    const slam = now(fight(["natural_weapons"], "ogre"), "Slam", "ogre");
    assert.deepEqual(
      [slam.damage!.count, slam.damage!.sides, slam.damage!.flat],
      [1, 6, 0],
      "a stat block's printed 5",
    );
    const magic = now(fight(["natural_weapons", "magic_weapon"]), "Unarmed Strike");
    assert.deepEqual(
      [magic.damage!.count, magic.damage!.sides, magic.damage!.flat],
      [1, 6, 4],
      "and Magic Weapon's +1",
    );
    // Unnamed, a flat blow stays flat.
    const staffOnly = now(fight(["shillelagh"]), "Unarmed Strike");
    assert.equal(staffOnly.damage!.count, 0);
  }

  // ── A stat block's blow: the numbers, no ability to swap ──
  {
    const state = fight(["magic_weapon", "shillelagh"], "ogre");
    const club = now(state, "Club", "ogre");
    assert.equal(club.toHit, 5);
    assert.equal(club.damage!.flat, 3);
  }

  // ── Refusals ──
  const withWeapon = (weapon: unknown) =>
    fiveE((doc) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "magic_weapon").weapon = weapon;
    });
  refused(withWeapon({ names: ["club"] }), /weapon changes something/);
  refused(withWeapon({ ability: "wis", abilityFrom: "spellcasting_ability" }), /not both/);
  refused(withWeapon({ ability: "luck" }), /Unknown ability "luck"/);
  refused(withWeapon({ abilityFrom: "casting" }), /Unknown field "casting"/);
  refused(withWeapon({ die: 1 }), /die/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions change their holder's weapons (a condition's weapon) requires schemaVersion 2 and capabilityApi 1.501 or newer";
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
    const only = JSON.parse(fiveEText) as Record<string, any>;
    only.combat.conditions[0].weapon = magicWeapon;
    assert.equal(getCapabilityPackageInstallIssue(manifest(500) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(501) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(500) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Weapon conditions: Magic Weapon adds to every weapon, Shillelagh makes a quarterstaff a Wisdom d8, read by the roll and the menu; gated at 1.501.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
