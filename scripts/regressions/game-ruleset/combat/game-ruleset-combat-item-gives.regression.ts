/**
 * An item's use that hands its user more of the turn (Capability API 1.334): `gives` on an item use, as
 * a catalog entry's (Action Surge). The Time-Flour Loaf, eaten for a bonus action, gives one more action
 * now; capped where it lands, so nothing is saved up. The install gate.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-gives-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 334);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const loafUse = {
    kind: "buff",
    targets: "self",
    budget: "bonus",
    consumes: true,
    gives: [{ budget: "action", count: 1 }],
  };
  const document = (use: Record<string, unknown> = loafUse): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "food", label: "Food" }] };
    doc.catalogs.push({
      id: "larder",
      label: "Larder",
      holds: "items",
      entries: [{ id: "loaf", label: "Time-Flour Loaf", item: { category: "food", use } }],
    });
    return doc;
  };
  const parsed = parseRulesetDefinition(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const loaf = definition.catalogs!.find((catalog) => catalog.id === "larder")!.entries![0]!.item as RulesetCatalogItem;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const block = {
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "pell",
        name: "Pell",
        side: "party",
        build,
        live: {},
        items: [{ item: loaf, quantity: 1, worn: false, name: "Time-Flour Loaf" }],
      },
      { id: "foe", name: "Foe", side: "enemy", block },
    ],
  });
  state.order = ["pell", "foe"];
  state.turn = 0;
  const before = rulesetCombatant(state, "pell")!.budgets;
  assert.equal(before.action, 1);
  const option = rulesetCombatOptions(definition, state, "pell").find((one) => one.id === "use:0");
  assert.ok(option, "the loaf is on the menu");
  assert.equal(option.budget, "bonus");
  const eaten = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "pell", optionId: "use:0", targetIds: ["pell"] },
    () => 10,
  );
  assert.equal(
    eaten.events.find((one) => one.type === "refused"),
    undefined,
    JSON.stringify(eaten.events),
  );
  const after = rulesetCombatant(eaten.state, "pell")!;
  assert.equal(after.budgets.action, 2, "one more action now");
  assert.equal(after.budgets.bonus, 0, "eaten for the bonus action");

  // ── Refused, and the gate ──
  assert.equal(parseRulesetDefinition(document({ ...loafUse, gives: [{ budget: "action", count: 0 }] })).ok, false);
  const gate =
    "A ruleset with an item use that gives its user more of the turn requires schemaVersion 2 and capabilityApi 1.334 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(333) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(334) as never, document()), gate);
  const { gives: _gives, ...plain } = loafUse;
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(333) as never, document(plain)), gate);

  console.log("Item gives: the Time-Flour Loaf, eaten for a bonus action, gives one more action now.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
