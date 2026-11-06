/**
 * Worn by a mount (Capability API 1.717): 5e's Horseshoes of a Zephyr, carried by the rider and worn
 * by the horse.
 *
 *   - An item's worn effect `{wornBy: "mount", keepsOn}`: what it keeps on goes on the creature its
 *     holder rides, as long as they ride it, and nothing of it on the holder.
 *   - Read afresh as they dismount; one not worn, or dropped, puts nothing on.
 *   - A `when` line read off the rider's sheet.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetSyncSpeeds } from "../../packages/shared/src/features/ruleset-combat/encounter.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-worn-by-mount-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 717);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shoes = { wornBy: "mount", keepsOn: ["zephyr"] };
  const fiveE = (worn: unknown = shoes): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "zephyr", label: "Horseshoes of a Zephyr" });
    doc.combat.conditions.push({ condition: "zephyr", effects: [], walksOnLiquid: true });
    doc.items = { categories: [{ id: "tack", label: "Tack" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs.push({
      id: "tack",
      label: "Tack",
      holds: "items",
      entries: [{ id: "zephyr-shoes", label: "Horseshoes of a Zephyr", item: { category: "tack", worn } }],
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
  const block = (): RulesetStatBlock =>
    ({ health: 20, defense: 10, initiativeModifier: 0, speed: 60, actions: [] }) as unknown as RulesetStatBlock;
  const ride = (definition: RulesetDefinition, worn = true): RulesetEncounterState => {
    const item = definition.catalogs!.find((one) => one.id === "tack")!.entries![0]!.item! as RulesetCatalogItem;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "rider",
          name: "Rider",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
          }),
          live: {},
          items: [{ name: "Horseshoes of a Zephyr", quantity: 1, worn, item } as RulesetSheetItem],
        },
        { id: "horse", name: "Horse", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    rulesetCombatant(state, "rider")!.mountedOn = "horse";
    rulesetCombatant(state, "horse")!.riddenBy = "rider";
    rulesetSyncSpeeds(definition, state);
    return state;
  };
  const holds = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes("zephyr");

  // ── Ridden, the horse wears them; the rider never does ──
  {
    const definition = parsed(fiveE());
    const state = ride(definition);
    assert.equal(holds(definition, state, "horse"), true);
    assert.equal(rulesetCombatant(state, "horse")!.walksOnLiquid, true, "it walks on water");
    assert.equal(holds(definition, state, "rider"), false);
    // Dismounted: off the horse, and still not on the rider.
    delete rulesetCombatant(state, "rider")!.mountedOn;
    delete rulesetCombatant(state, "horse")!.riddenBy;
    rulesetSyncSpeeds(definition, state);
    assert.equal(holds(definition, state, "horse"), false);
    assert.equal(rulesetCombatant(state, "horse")!.walksOnLiquid, undefined);
    assert.equal(holds(definition, state, "rider"), false);
    // Carried and not worn, nothing.
    assert.equal(holds(definition, ride(definition, false), "horse"), false);
  }

  // ── A `when` line read off the rider's sheet ──
  {
    const high = parsed(fiveE({ wornBy: "mount", keepsOn: [{ condition: "zephyr", when: { field: "level" } }] }));
    assert.equal(holds(high, ride(high), "horse"), true);
    const never = parsed(fiveE({ wornBy: "mount", keepsOn: [{ condition: "zephyr", when: { const: 0 } }] }));
    assert.equal(holds(never, ride(never), "horse"), false);
  }

  // ── Refusals ──
  refused(fiveE({ wornBy: "mount" }), /"wornBy" goes with "keepsOn" and nothing else/);
  refused(fiveE({ wornBy: "mount", keepsOn: ["zephyr"], alerts: 15 }), /"wornBy" goes with "keepsOn" and nothing else/);
  refused(fiveE({ wornBy: "rider", keepsOn: ["zephyr"] }), /wornBy/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item worn by its holder's mount (wornBy) requires schemaVersion 2 and capabilityApi 1.717 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(716) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(717) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(716) as never, fiveE({ keepsOn: ["zephyr"] })), gate);
  }

  console.log(
    "Worn by a mount: the rider's Horseshoes of a Zephyr keep the horse walking on water while ridden, never the rider, and come off as they dismount; gated at 1.717.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
