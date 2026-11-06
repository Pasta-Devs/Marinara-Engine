/**
 * Item uses centred on their user (Capability API 1.532).
 *
 *   - The Staff of Thunder and Lightning's Thunderclap: a burst `around` its wielder, never aimed,
 *     catches everybody within 60 feet but the wielder; one farther off is not caught. A `moreUses`
 *     entry may be one too.
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
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-use-around-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 532);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const clap = (area: Record<string, unknown>) => ({
    kind: "attack",
    budget: "action",
    amount: { dice: "2d6" },
    damageType: "thunder",
    save: { save: "con_save", onSuccess: "half" },
    saveDifficulty: 17,
    area,
  });
  const document = (area: Record<string, unknown> = { shape: "burst", size: 60, around: true }, more = false) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "staff", label: "Staff" }] };
    const item: Record<string, any> = { category: "staff", stack: 1, use: { label: "Thunderclap", ...clap(area) } };
    if (more) {
      item.use = {
        label: "Strike",
        kind: "attack",
        budget: "action",
        range: 30,
        attackRoll: true,
        toHit: { bonus: 5 },
        amount: { dice: "1d6" },
        damageType: "force",
      };
      item.moreUses = [{ label: "Thunderclap", use: clap(area) }];
    }
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "staff", label: "Staff", item }] });
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
  const foe = (): RulesetStatBlock =>
    ({ health: 200, defense: 1, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const run = (definition: RulesetDefinition, label: string) => {
    const entries: Record<string, RulesetCatalogEntry[]> = {
      gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
    };
    const book = rulesetItemBook(definition, entries);
    const staff = {
      item: book.itemOf("gear/staff")!.entry.item!,
      quantity: 1,
      name: "Staff",
      worn: true,
    } as RulesetSheetItem;
    const width = 20;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items: [staff] },
        { id: "near", name: "Near", side: "enemy", block: foe() },
        { id: "far", name: "Far", side: "enemy", block: foe() },
      ],
      board: {
        grid: { width, height: 1, tiles: [Array(width).fill("plains")], elevation: [Array(width).fill(0)] } as never,
        placements: { hero: { x: 0, y: 0 }, near: { x: 10, y: 0 }, far: { x: 15, y: 0 } },
      },
    });
    state.order = ["hero", "near", "far"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label.endsWith(label));
    assert.ok(option, JSON.stringify(rulesetCombatOptions(definition, state, "hero").map((one) => one.label)));
    assert.equal(option!.targets.count, 0, "never aimed");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option!.id, targetIds: [] } as RulesetCombatChoice,
      () => 3,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    const hurt = new Set(of(step.events, "damage").map((one) => one.targetId));
    assert.ok(hurt.has("near"), "50 feet off, caught");
    assert.ok(!hurt.has("far"), "75 feet off, not");
    assert.ok(!hurt.has("hero"), "not its wielder");
  };
  run(parsed(document()), "Thunderclap");
  run(parsed(document(undefined, true)), "Thunderclap");

  // ── Refusals ──
  refused(document({ shape: "cone", size: 60, around: true }), /Only a single burst is centred on its user/);
  refused(document({ shape: "burst", size: 60, throughWalls: true }), /goes through walls/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item's use centred on its user (use area around) requires schemaVersion 2 and capabilityApi 1.532 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(531) as never, document()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(531) as never, document(undefined, true)),
      gate,
      "more uses",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(532) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(531) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item use around: a staff's Thunderclap, first use or one of its more, catches everybody within 60 feet but its wielder and nobody farther; gated at 1.532.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
