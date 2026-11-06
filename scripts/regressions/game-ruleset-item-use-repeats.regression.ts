/**
 * An item's use made again while concentrated on (Capability API 1.583): a scroll of Heat Metal.
 *
 *   - `use.repeats` with `concentration`: the scroll is spent once; while its user concentrates, its
 *     effect is offered again on `repeats.budget`, spending nothing of the item.
 *   - `repeats` without `concentration`, or on an unknown budget, is refused.
 *   - The install gate.
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
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-use-repeats-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 583);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const heat = (extra: Record<string, unknown> = {}) => ({
    kind: "attack",
    budget: "action",
    range: 60,
    autoHit: true,
    amount: { flat: 4 },
    damageType: "fire",
    concentration: true,
    repeats: { budget: "bonus", sameTargets: true },
    consumes: true,
    ...extra,
  });
  const document = (use: Record<string, unknown> = heat()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "scroll", label: "Scroll of Heat Metal", item: { category: "gear", use } }],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const scroll = {
    name: "Scroll of Heat Metal",
    quantity: 1,
    item: { category: "gear", use: heat() },
  } as unknown as RulesetSheetItem;
  const block = {
    health: 100,
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
        id: "mage",
        name: "Mage",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
        }),
        live: {},
        items: [scroll],
      },
      { id: "knight", name: "Knight", side: "enemy", block },
      { id: "squire", name: "Squire", side: "enemy", block },
    ],
  });
  state.order = ["mage", "knight", "squire"];
  state.turn = 0;
  const options = (s: typeof state) => rulesetCombatOptions(definition, s, "mage");
  const read = options(state).find((one) => one.label.includes("Scroll of Heat Metal") && !one.id.endsWith(":again"));
  assert.ok(read, "the scroll is offered");
  assert.ok(!options(state).some((one) => one.id.endsWith(":again")), "nothing to repeat yet");
  const first = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "mage", optionId: read.id, targetIds: ["knight"] },
    () => 10,
  );
  assert.deepEqual(of(first.events, "refused"), []);
  assert.equal(of(first.events, "damage").filter((one) => one.targetId === "knight").length, 1);
  const mage = rulesetCombatant(first.state, "mage")!;
  assert.ok(mage.concentrating, "concentrating on the scroll's spell");
  const again = options(first.state).find((one) => one.id.endsWith(":again"));
  assert.ok(again, "offered again while concentrated on");
  assert.equal(again.budget, "bonus");
  const second = applyRulesetCombatChoice(
    definition,
    first.state,
    { actorId: "mage", optionId: again.id, targetIds: ["knight"] },
    () => 10,
  );
  assert.deepEqual(of(second.events, "refused"), []);
  assert.equal(of(second.events, "damage").filter((one) => one.targetId === "knight").length, 1, "heated again");
  assert.deepEqual(
    rulesetCombatant(second.state, "mage")!.sheet?.items ?? rulesetCombatant(second.state, "mage")!.sheet,
    rulesetCombatant(first.state, "mage")!.sheet?.items ?? rulesetCombatant(first.state, "mage")!.sheet,
    "nothing more of the item spent",
  );
  // Only at whom the scroll was read at.
  const atSquire = applyRulesetCombatChoice(
    definition,
    first.state,
    { actorId: "mage", optionId: again.id, targetIds: ["squire"] },
    () => 10,
  );
  assert.ok(of(atSquire.events, "refused").length > 0, "sameTargets");

  // ── Refusals ──
  refused(document(heat({ concentration: undefined })), /"repeats" is made again while its user concentrates/);
  refused(document(heat({ repeats: { budget: "nope" } })), /Unknown budget "nope"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item's use made again while its user concentrates (use.repeats) requires schemaVersion 2 and capabilityApi 1.583 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(582) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(583) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(582) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item use repeats: a scroll of Heat Metal is read once and heats its target again on a bonus action; gated at 1.583.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
