/**
 * Items that keep conditions on and lengthen jumps (Capability API 1.513), and conditions damage
 * stops until their holder's next turn (1.514).
 *
 *   - Boots of Striding and Springing: worn, a jump three times as far; carried, nothing.
 *   - Ioun Stone of Awareness: worn, a condition on its holder that is never written to the sheet,
 *     and gone once it is taken off.
 *   - Cloak of Displacement: attacks at its wearer lean against the attacker until a blow lands, and
 *     again from the wearer's next turn (1.514).
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetJumpReach,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-worn-keeps-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 513);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const boots = { jumps: { times: 3 } };
  const stone = { keepsOn: ["alert"] };
  const fiveE = (worn: Record<string, unknown> = boots): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "alert", label: "Awareness" });
    doc.sheet.live.conditions.push({ id: "displaced", label: "Displaced" });
    doc.combat.conditions.push(
      { condition: "alert", effects: [], cannotBeSurprised: true },
      {
        condition: "displaced",
        effects: ["attacks-against-disadvantage"],
        suppressedWhenHarmed: "until-own-turn-start",
      },
    );
    doc.combat.jumping = {
      long: { ability: "str", of: "score" },
      high: { ability: "str", of: "modifier", plus: 3 },
      runUp: 10,
      standing: "half",
    };
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "trinkets",
      label: "Trinkets",
      holds: "items",
      entries: [{ id: "trinket", label: "Trinket", item: { category: "gear", worn } }],
    });
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
  parsed(fiveE(stone));
  const item = (name: string, worn: boolean, effect: Record<string, unknown>): RulesetSheetItem => ({
    name,
    quantity: 1,
    worn,
    item: { category: "gear", worn: effect } as RulesetSheetItem["item"],
  });
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 10,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ id: "claw", name: "Claw", budget: "action", reach: 60, toHit: 30, damage: { flat: 2 } }],
          } as never,
        },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] } as never,
        placements: { hero: { x: 0, y: 0 }, foe: { x: 11, y: 0 } },
      },
    });
    state.order = ["hero", "foe"];
    state.turn = 0;
    return state;
  };
  const hero = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;

  // ── Boots of Striding and Springing: a standing long jump of 7 feet, 22 with them on ──
  {
    const state = fight();
    assert.equal(rulesetJumpReach(definition, state, hero(state))!.long, 1);
    hero(state).sheet!.items = [item("Boots of Striding and Springing", true, boots)];
    assert.equal(rulesetJumpReach(definition, state, hero(state))!.long, 4, "three times as far");
    hero(state).sheet!.items = [item("Boots of Striding and Springing", false, boots)];
    assert.equal(rulesetJumpReach(definition, state, hero(state))!.long, 1, "carried, nothing");
  }

  // ── Ioun Stone of Awareness: a condition on its holder while worn, never on the sheet ──
  {
    const state = fight();
    const alert = () =>
      rulesetActiveConditions(definition, definition.combat!, hero(state), state).some(
        (one) => one.condition === "alert" && one.cannotBeSurprised,
      );
    assert.equal(alert(), false);
    hero(state).sheet!.items = [item("Ioun Stone of Awareness", true, stone)];
    assert.equal(alert(), true, "worn, it keeps the condition on");
    assert.ok(rulesetCombatConditions(definition, hero(state)).includes("alert"));
    assert.ok(!hero(state).tracked.some((one) => one.condition === "alert"), "never written down");
    hero(state).sheet!.items = [];
    assert.equal(alert(), false, "taken off, it goes");
  }

  // ── Cloak of Displacement: a blow that lands stops it until the wearer's next turn (1.514) ──
  {
    const state = fight();
    hero(state).sheet!.items = [item("Cloak of Displacement", true, { keepsOn: ["displaced"] })];
    const displaced = (now: RulesetEncounterState) =>
      rulesetActiveConditions(definition, definition.combat!, hero(now), now).some(
        (one) => one.condition === "displaced",
      );
    assert.equal(displaced(state), true);
    const ended = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "end-turn", targetIds: [] },
      () => 10,
    );
    const option = rulesetCombatOptions(definition, ended.state, "foe").find((one) => one.label === "Claw");
    assert.ok(option);
    const clawed = applyRulesetCombatChoice(
      definition,
      ended.state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.ok(
      clawed.events.some((one) => one.type === "damage" && one.targetId === "hero"),
      JSON.stringify(clawed.events),
    );
    assert.equal(displaced(clawed.state), false, "stopped by the blow");
    assert.deepEqual(hero(clawed.state).harmStopped, ["displaced"]);
    const back = applyRulesetCombatChoice(
      definition,
      clawed.state,
      { actorId: "foe", optionId: "end-turn", targetIds: [] },
      () => 10,
    );
    assert.equal(back.state.order[back.state.turn], "hero");
    assert.equal(displaced(back.state), true, "working again as the wearer's turn starts");
  }

  // ── Refusals ──
  refused(fiveE({ keepsOn: ["vigilant"] }), /Unknown condition "vigilant"/);
  refused(fiveE({ jumps: { plus: { ability: "luck" } } }), /Unknown ability "luck"/);
  refused(fiveE({ jumps: {} }), /times or plus/);
  refused(fiveE({ keepsOn: [] }), /keepsOn/);
  {
    const doc = fiveE();
    doc.combat.conditions.find((one: any) => one.condition === "displaced").suppressedWhenHarmed = "until-healed";
    refused(doc, /suppressedWhenHarmed/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items keep conditions on their holder or lengthen their jumps (an item effect's keepsOn or jumps) requires schemaVersion 2 and capabilityApi 1.513 or newer";
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
    // Without the cloak's condition, whose own gate is newer.
    const older = (worn: Record<string, unknown>) => {
      const doc = fiveE(worn);
      delete doc.combat.conditions.find((one: any) => one.condition === "displaced").suppressedWhenHarmed;
      return doc;
    };
    for (const worn of [boots, stone]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(512) as never, older(worn)), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(513) as never, older(worn)), gate);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(512) as never, older({ fallsSafely: true })),
      gate,
      "other item effects are older",
    );
    const harmGate =
      "A ruleset whose conditions stop working when their holder takes damage (suppressedWhenHarmed) requires schemaVersion 2 and capabilityApi 1.514 or newer";
    const cloak = JSON.parse(fiveEText) as Record<string, any>;
    cloak.combat.conditions[0].suppressedWhenHarmed = "until-own-turn-start";
    assert.equal(getCapabilityPackageInstallIssue(manifest(513) as never, cloak), harmGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(514) as never, cloak), harmGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(513) as never, JSON.parse(fiveEText)), harmGate);
  }

  console.log(
    "Worn keeps: Boots of Striding and Springing triple a jump while worn, an Ioun Stone keeps its condition on while worn and never on the sheet, a Cloak of Displacement stops on a blow until its wearer's next turn; gated at 1.513 and 1.514.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
