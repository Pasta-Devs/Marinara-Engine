/**
 * Item uses beside one another (Capability API 1.535).
 *
 *   - The Staff of Thunder and Lightning's Thunder and Lightning: its Lightning Strike at whom it is
 *     aimed, and its Thunderclap (`alongside`) on everybody its burst around the wielder catches, in
 *     one action. Only its own daily use is spent, neither of theirs.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-uses-alongside-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 535);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const dawn = { max: 1, recharge: { rests: ["long"], amount: "max" } };
  const lightning = {
    kind: "attack",
    budget: "action",
    range: 120,
    amount: { dice: "9d6" },
    damageType: "lightning",
    save: { save: "dex_save", onSuccess: "half" },
    saveDifficulty: 17,
  };
  const clap = {
    kind: "attack",
    budget: "action",
    amount: { dice: "2d6" },
    damageType: "thunder",
    save: { save: "con_save", onSuccess: "half" },
    saveDifficulty: 17,
    area: { shape: "burst", size: 60, around: true },
  };
  const document = (edit: (item: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "staff", label: "Staff" }] };
    const item: Record<string, any> = {
      category: "staff",
      stack: 1,
      use: {
        label: "Strike",
        kind: "attack",
        budget: "action",
        range: 30,
        attackRoll: true,
        toHit: { bonus: 5 },
        amount: { dice: "1d6" },
        damageType: "force",
      },
      moreUses: [
        { label: "Lightning Strike", use: structuredClone(lightning), uses: dawn },
        { label: "Thunderclap", use: structuredClone(clap), uses: dawn },
        { label: "Thunder and Lightning", use: structuredClone(lightning), uses: dawn, alongside: ["Thunderclap"] },
      ],
    };
    edit(item);
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
    ({
      health: 200,
      defense: 1,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0, con_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });

  // ── Thunder and Lightning: the bolt at the far one, the clap on the near, one use spent ──
  {
    const definition = parsed(document());
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
    const width = 30;
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
        placements: { hero: { x: 0, y: 0 }, near: { x: 10, y: 0 }, far: { x: 20, y: 0 } },
      },
    });
    state.order = ["hero", "near", "far"];
    state.turn = 0;
    const options = rulesetCombatOptions(definition, state, "hero");
    const both = options.find((one) => one.label === "Staff: Thunder and Lightning");
    assert.ok(both, JSON.stringify(options.map((one) => one.label)));
    const hero = rulesetCombatant(state, "hero")!;
    assert.deepEqual(hero.actions.find((one) => one.id === both!.id)?.alongside, ["use:0:2"]);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: both!.id, targetIds: ["far"] } as RulesetCombatChoice,
      () => 3,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    const hurt = of(step.events, "damage").map((one) => [one.targetId, one.label]);
    assert.ok(
      hurt.some(([id, label]) => id === "far" && label === "Staff: Thunder and Lightning"),
      JSON.stringify(hurt),
    );
    assert.ok(
      hurt.some(([id, label]) => id === "near" && label === "Staff: Thunderclap"),
      "the near one is caught by the clap beside it",
    );
    assert.ok(!hurt.some(([id]) => id === "hero"), "not its wielder");
    assert.ok(!hurt.some(([id, label]) => id === "far" && label === "Staff: Thunderclap"), "the far one is past it");
    assert.deepEqual(
      of(step.events, "alongside").map((one) => [one.label, one.to]),
      [["Staff: Thunderclap", "Staff: Thunder and Lightning"]],
    );
    const after = rulesetCombatant(step.state, "hero")!;
    assert.deepEqual(after.usesLeft, { "0:3": 0 }, "its own use, neither of the others'");
  }

  // ── Refusals ──
  refused(
    document((item) => (item.moreUses[2].alongside = ["Thunderbolt"])),
    /No other use of the item is "Thunderbolt"/,
  );
  refused(
    document((item) => (item.moreUses[2].alongside = ["Thunder and Lightning"])),
    /A use is never beside itself/,
  );
  refused(
    document((item) => (item.moreUses[2].alongside = ["Lightning Strike"])),
    /A use beside another is centred on its user \(area around\), so nothing is aimed twice/,
  );
  refused(
    document((item) => (item.moreUses[1].alongside = ["Strike"])),
    /centred on its user/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item's use that sets off others beside it (moreUses alongside) requires schemaVersion 2 and capabilityApi 1.535 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(534) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(535) as never, document()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(534) as never,
        document((item) => delete item.moreUses[2].alongside),
      ),
      gate,
    );
  }

  console.log(
    "Item uses alongside: Thunder and Lightning's bolt at whom it is aimed and its Thunderclap around the wielder in one action, spending only its own daily use; refusals and the gate at 1.535.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
