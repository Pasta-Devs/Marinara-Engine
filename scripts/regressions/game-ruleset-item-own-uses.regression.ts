/**
 * An item's further uses that count their own (Capability API 1.519).
 *
 *   - A staff with a cone on its charges and a Thunderclap once a long rest: the fight offers the
 *     Thunderclap while it is left, spends its own use (never a charge), and writes it to the stack.
 *   - Outside a fight: the same use by its place, refused once spent, back on a long rest only.
 *   - Up to 16 further uses; refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rechargeRulesetItems,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemUseLine,
  rulesetSheetBuildSchema,
  rulesetSheetItems,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-own-uses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 519);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const heal = { kind: "heal", targets: "self", budget: "action", amount: { dice: "1d4" } };
  const thunderclap = (more: Record<string, unknown> = {}) => ({
    label: "Thunderclap",
    use: { ...heal },
    uses: { max: 1, recharge: { rests: ["long"], amount: "max" } },
    ...more,
  });
  const document = (moreUses: unknown[] = [thunderclap()]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "staff", label: "Staff" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "staff",
          label: "Storm Staff",
          item: {
            category: "staff",
            stack: 1,
            charges: { max: 3 },
            use: { ...heal, label: "Mend", charges: 1 },
            moreUses,
          },
        },
      ],
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
  const definition = parsed(document());
  const entriesOf = (one: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (one.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const book = rulesetItemBook(definition, entriesOf(definition));
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const bag: GameInventoryStack[] = [{ id: "s", name: "Storm Staff", item: "gear/staff", quantity: 1 }];

  // ── In a fight: its own use, never a charge, written to the stack ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items: rulesetSheetItems(book, bag, undefined) },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    const offered = rulesetCombatOptions(definition, state, "hero");
    assert.ok(
      offered.some((one) => one.id === "use:0"),
      "its first use",
    );
    assert.ok(
      offered.some((one) => one.id === "use:0:1"),
      "its Thunderclap",
    );
    const used = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "use:0:1", targetIds: ["hero"] },
      () => 2,
    );
    const hero = rulesetCombatant(used.state, "hero")!;
    assert.equal(hero.usesLeft?.["0:1"], 0);
    assert.equal(hero.charges?.["0"], undefined, "no charge spent");
    const changes = rulesetFightItemChanges(state, used.state);
    assert.deepEqual(changes[0]?.usesLeft, { "1": 0 });
    const written = applyRulesetFightItemChanges(bag, changes)!;
    assert.deepEqual(written.stacks[0]!.usesLeft, { "1": 0 });
    // Kept through a save and a read.
    assert.deepEqual(normalizeGameInventoryStacks(JSON.parse(JSON.stringify(written.stacks)))[0]!.usesLeft, { "1": 0 });
    // A fight that starts from that stack offers it no more, though the charges are full.
    const later = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items: rulesetSheetItems(book, written.stacks, undefined) },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    later.turn = later.order.indexOf("hero");
    const again = rulesetCombatOptions(definition, later, "hero");
    assert.ok(!again.some((one) => one.id === "use:0:1"), "spent");
    assert.ok(
      again.some((one) => one.id === "use:0"),
      "its charges still",
    );
  }

  // ── Outside a fight, and back on a long rest only ──
  {
    const use = (stacks: GameInventoryStack[], more?: number) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks,
        stackId: "s",
        user: { name: "Ada", build, live: {} },
        roll: () => 2,
        ...(more !== undefined ? { more } : {}),
      });
    const first = use(bag, 1);
    assert.ok(first.ok, JSON.stringify(first));
    if (!first.ok) throw new Error();
    assert.deepEqual(first.stacks[0]!.usesLeft, { "1": 0 });
    assert.equal(first.stacks[0]!.charges, undefined, "no charge spent");
    assert.match(rulesetItemUseLine(first.said), /Storm Staff: Thunderclap.*0 of 1 uses of it left/);
    assert.deepEqual(use(first.stacks, 1), { ok: false, reason: "none-left" });
    assert.ok(use(first.stacks).ok, "its first use on its charges");
    assert.deepEqual(use(bag, 2), { ok: false, reason: "no-use" });
    const short = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks: first.stacks,
      holder: undefined,
      rest: "short",
      roll: () => 1,
    });
    assert.deepEqual(short.recharged, []);
    const long = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks: first.stacks,
      holder: undefined,
      rest: "long",
      roll: () => 1,
    });
    assert.equal(long.stacks[0]!.usesLeft, undefined, "full again");
    assert.deepEqual(long.recharged, [{ item: "Storm Staff: Thunderclap", now: 1, max: 1, uses: true }]);
  }

  // ── Up to 16; refusals ──
  {
    const sixteen = Array.from({ length: 16 }, (_, n) => thunderclap({ label: `Gem ${n + 1}` }));
    parsed(document(sixteen));
    refused(document([...sixteen, thunderclap({ label: "Gem 17" })]), /moreUses/);
    refused(document([thunderclap({ use: { ...heal, charges: 1 } })]), /its own uses spends those/);
    refused(
      document([thunderclap({ uses: { max: 1, recharge: { rests: ["dawn"], amount: "max" } } })]),
      /Unknown rest "dawn"/,
    );
    refused(document([thunderclap({ uses: { max: 0 } })]), /uses/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items have further uses that count their own, or more than 8 of them (moreUses uses), requires schemaVersion 2 and capabilityApi 1.519 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(518) as never, document()), gate);
    const nine = Array.from({ length: 9 }, (_, n) => ({ label: `Bead ${n + 1}`, use: { ...heal, charges: 1 } }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(518) as never, document(nine)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(519) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(518) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Own uses: a further use counts its own uses in a fight and outside one, kept on the stack and back on its own rest, never spending a charge; up to 16 further uses; gated at 1.519.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
