/**
 * Items that hold conditions off (Capability API 1.477), by name or by kind (1.484).
 *
 *   - Periapt of Health: a disease already caught is held off while it is worn, not ended; no new one
 *     is caught; taken off, the old one holds again.
 *   - Refusals and the install gate (the Ring of Feather Falling's fall is in the falls regression).
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-worn-holds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 477);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const periapt = { conditionImmunities: ["sewer_plague"], suppresses: ["sewer_plague"] };
  const fiveE = (worn: Record<string, unknown> = periapt): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "sewer_plague", label: "Sewer Plague" });
    doc.combat.conditions.push({
      condition: "sewer_plague",
      effects: ["own-attacks-disadvantage"],
      kinds: ["disease"],
    });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "trinkets",
      label: "Trinkets",
      holds: "items",
      entries: [{ id: "periapt", label: "Periapt of Health", item: { category: "gear", worn } }],
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
  const rat = {
    health: 20,
    defense: 8,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "bite",
        name: "Bite",
        budget: "action",
        reach: 5,
        toHit: 20,
        damage: { flat: 1 },
        applies: [{ condition: "sewer_plague", duration: { rounds: 100 } }],
      },
    ],
  } as unknown as RulesetStatBlock;
  const item = (worn: boolean, effect: Record<string, unknown> = periapt): RulesetSheetItem => ({
    name: "Periapt of Health",
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
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
        },
        { id: "rat", name: "Rat", side: "enemy", block: rat },
      ],
      board: {
        grid: { width: 8, height: 8, tiles: Array.from({ length: 8 }, () => Array(8).fill("plains")) },
        placements: { hero: { x: 1, y: 1 }, rat: { x: 2, y: 1 } },
      },
    });
    state.order = ["hero", "rat"];
    state.turn = 0;
    return state;
  };
  const hero = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;
  const bite = (state: RulesetEncounterState) => {
    state.turn = 1;
    rulesetCombatant(state, "rat")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "rat").find((one) => one.label === "Bite");
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "rat", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const sick = (state: RulesetEncounterState) =>
    rulesetActiveConditions(definition, definition.combat!, hero(state), state).some(
      (one) => one.condition === "sewer_plague",
    );
  const tracked = (state: RulesetEncounterState) =>
    hero(state).tracked.filter((one) => one.condition === "sewer_plague");

  // ── Caught before it was put on: held off while worn, not ended ──
  {
    const state = fight();
    hero(state).tracked.push({ condition: "sewer_plague", rounds: 50, source: "rat" });
    assert.equal(sick(state), true, "sick without it");
    hero(state).sheet!.items = [item(true)];
    assert.equal(sick(state), false, "held off");
    const events: RulesetCombatEvent[] = bite(state);
    assert.ok(
      events.some((one) => one.type === "condition" && one.reason === "immune" && one.condition === "sewer_plague"),
      "no new one is caught",
    );
    assert.equal(tracked(state).length, 1, "the old one is still there");
    assert.equal(tracked(state)[0]!.rounds, 50);
    hero(state).sheet!.items = [];
    assert.equal(sick(state), true, "taken off, it holds again");
    // Only carried, it does nothing.
    hero(state).sheet!.items = [item(false)];
    assert.equal(sick(state), true);
  }

  // ── By kind (1.484): every disease held off, and none caught ──
  {
    const byKind = { conditionImmunities: ["disease"], suppresses: ["disease"] };
    parsed(fiveE(byKind));
    const state = fight();
    hero(state).tracked.push({ condition: "sewer_plague", rounds: 50, source: "rat" });
    hero(state).sheet!.items = [item(true, byKind)];
    assert.equal(sick(state), false, "held off by its kind");
    const events: RulesetCombatEvent[] = bite(state);
    assert.ok(
      events.some((one) => one.type === "condition" && one.reason === "immune" && one.condition === "sewer_plague"),
      "no new one is caught",
    );
    assert.equal(tracked(state).length, 1, "the old one is still there");
    hero(state).sheet!.items = [];
    assert.equal(sick(state), true);
  }

  // ── Refusals ──
  refused(fiveE({ suppresses: ["the_vapours"] }), /Unknown condition "the_vapours"/);
  refused(fiveE({ fallsSafely: false }), /fallsSafely/);
  parsed(fiveE({ fallsSafely: true }));

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items soften a fall or hold conditions off (fallsSafely or suppresses on an item's effect) requires schemaVersion 2 and capabilityApi 1.477 or newer";
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
    for (const worn of [periapt, { fallsSafely: true }]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(476) as never, fiveE(worn)), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(477) as never, fiveE(worn)), gate);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(476) as never, fiveE({ conditionImmunities: ["sewer_plague"] })),
      gate,
      "immunities alone are older",
    );
    const kindGate =
      "A ruleset whose items hold off a kind of condition (suppresses naming a kind) requires schemaVersion 2 and capabilityApi 1.484 or newer";
    const byKind = fiveE({ suppresses: ["disease"] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(483) as never, byKind), kindGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(484) as never, byKind), kindGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(483) as never, fiveE()), kindGate, "by name is 1.477's");
  }

  console.log(
    "Worn holds: a Periapt of Health holds a caught disease off and keeps new ones off, and it holds again once taken off; gated at 1.477.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
