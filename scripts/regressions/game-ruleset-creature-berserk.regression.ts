/**
 * A golem's Berserk (Capability API 1.543).
 *
 *   - `rollsAtTurnStart`: at 40 hit points or fewer, a 6 on a d6 as its turn starts puts berserk on
 *     it; a 5 does not; above 40 nothing is rolled.
 *   - `behavior.nearest`: berserk, it goes at the nearest creature it can see, its own side's too,
 *     walked beside it, and may attack nobody else.
 *   - `endsAtFullHealth`: healed back to full, berserk ends.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetGap,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-berserk-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 543);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entries = [
    {
      id: "mend",
      label: "Mend",
      rows: [{ list: "spells", values: { name: "Mend", level: 0, prepared: true } }],
      mechanics: { kind: "heal", targets: "any", range: 120, amount: { flat: 200 } },
    },
  ].map((entry) => entry as unknown as RulesetCatalogEntry);
  const berserk = {
    healthAtMost: 40,
    dice: "1d6",
    atLeast: 6,
    applies: [{ condition: "berserk", duration: "until-dispelled" }],
  };
  const fiveE = (rolls: unknown = [berserk], rule: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "berserk", label: "Berserk" });
    doc.combat.conditions.push({
      condition: "berserk",
      effects: [],
      behavior: { nearest: true },
      endsAtFullHealth: true,
      ...rule,
    });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries;
    creatures.push({
      id: "golem",
      label: "Flesh Golem",
      creature: {
        health: 93,
        defense: 9,
        initiativeModifier: 0,
        speed: 30,
        tier: "cr_5",
        actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 7, damage: { flat: 13 }, reach: 5 }],
        rollsAtTurnStart: rolls,
      },
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const golem = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "golem"),
  );
  assert.ok(golem);
  const fight = (health: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "golem", name: "Flesh Golem", side: "enemy", block: golem },
        { id: "imp", name: "Imp", side: "enemy", block: { ...golem, rollsAtTurnStart: undefined, health: 10 } },
      ],
      board: {
        grid: { width: 14, height: 14, tiles: Array.from({ length: 14 }, () => Array(14).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, golem: { x: 6, y: 6 }, imp: { x: 6, y: 9 } },
      },
    });
    state.order = ["mage", "golem", "imp"];
    state.turn = 0;
    rulesetCombatant(state, "golem")!.health!.value = health;
    return state;
  };
  const endTurn = (state: RulesetEncounterState, actorId: string, roll: number) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.kind === "end-turn");
    assert.ok(option, "no end of turn");
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id }, () => roll);
  };
  const holds = (state: RulesetEncounterState) => rulesetCombatant(state, "golem")!.tracked.map((one) => one.condition);

  // ── A 6 at 30 hit points: berserk, at the imp beside it, walked there, and only the imp ──
  const rolled = endTurn(fight(30), "mage", 6);
  {
    assert.deepEqual(
      of(rolled.events, "turnRoll").map((one) => [one.actorId, one.roll, one.atLeast, one.conditions]),
      [["golem", 6, 6, ["berserk"]]],
    );
    assert.deepEqual(holds(rolled.state), ["berserk"]);
    assert.deepEqual(
      of(rolled.events, "goesAt").map((one) => one.targetId),
      ["imp"],
      "the imp, 15 feet off, is nearer than the mage",
    );
    const state = rolled.state;
    assert.equal(rulesetGap(rulesetCombatant(state, "golem"), rulesetCombatant(state, "imp")), 1, "walked beside it");
    const slam = rulesetCombatOptions(definition, state, "golem").find((one) => one.label === "Slam");
    assert.ok(slam);
    assert.deepEqual(rulesetOptionTargets(definition, state, "golem", slam, true), ["imp"], "nobody else");
  }

  // ── A 5: nothing; above 40: nothing rolled ──
  {
    const missed = endTurn(fight(30), "mage", 5);
    assert.deepEqual(
      of(missed.events, "turnRoll").map((one) => one.roll),
      [5],
    );
    assert.deepEqual(holds(missed.state), []);
    assert.deepEqual(of(missed.events, "goesAt"), []);
    const hale = endTurn(fight(41), "mage", 6);
    assert.deepEqual(of(hale.events, "turnRoll"), [], "above 40: no roll");
  }

  // ── Healed back to full, berserk ends ──
  {
    let state = endTurn(rolled.state, "golem", 10).state;
    state = endTurn(state, "imp", 10).state;
    assert.equal(state.order[state.turn], "mage");
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const mend = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Mend");
    assert.ok(mend);
    const healed = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: mend.id, targetIds: ["golem"] },
      () => 10,
    );
    assert.deepEqual(of(healed.events, "refused"), []);
    assert.deepEqual(holds(healed.state), [], "back at 93: berserk ends");
  }

  // ── Refusals ──
  refused(
    fiveE([{ ...berserk, applies: [{ condition: "frenzied", duration: "until-dispelled" }] }]),
    /Unknown condition "frenzied"/,
  );
  refused(fiveE([{ ...berserk, atLeast: 7 }]), /No roll of its dice reaches it/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a low-health roll at turn start (rollsAtTurnStart), a condition sending its holder at the nearest creature (behavior nearest) or ending at full health (endsAtFullHealth) requires schemaVersion 2 and capabilityApi 1.543 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(542) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(543) as never, fiveE()), gate);
  }

  console.log(
    "Berserk: a golem at 40 or fewer rolls a d6 as its turn starts, a 6 sending it at the nearest creature it sees, walked beside it and at nobody else, ended when healed to full; refused for an unknown condition or a roll it cannot make; gated at 1.543.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
