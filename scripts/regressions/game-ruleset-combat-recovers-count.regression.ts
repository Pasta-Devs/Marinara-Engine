/**
 * Spent pools given back by count (Capability API 1.656): 5e's Pearl of Power, "you can use an action
 * to speak its command word and regain one expended spell slot of up to 3rd level".
 *
 *   - Out of a fight, the item's use gives back the highest spent slot of 3rd level or lower, one.
 *   - In a fight the same, as its user's action.
 *   - None spent low enough, nothing comes back.
 *   - Refused without a count on an item, aimed at another, or with an unknown group.
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
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-recovers-count-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 656);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const pearlUse = () => ({
    kind: "buff",
    budget: "action",
    label: "Regain a slot",
    targets: "self",
    recovers: { group: "slots", upTo: { const: 3 }, most: 3, count: 1 },
  });
  const document = (edit: (use: Record<string, any>, doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    const use = pearlUse();
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [{ id: "pearl", label: "Pearl of Power", item: { category: "gear", use } }],
    });
    edit(use, doc);
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    fields: {
      level: 9,
      spellcasting_ability: "int",
      ac: 12,
      speed: 30,
      hp_max: 50,
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 3,
      slots_max_4: 3,
      slots_max_5: 1,
    },
  });
  const liveWith = (pools: Record<string, number>) => ({
    pools: Object.fromEntries(Object.entries(pools).map(([id, value]) => [id, { value }])),
  });
  const slots = (live: unknown) =>
    Object.fromEntries(
      readRulesetLive(definition, build, live)
        .pools.filter((pool) => pool.key.startsWith("slots_"))
        .map((pool) => [pool.key, pool.value]),
    );
  const entries = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries);

  // ── Out of a fight: the highest spent slot of 3rd level or lower ──
  {
    const outside = (live: unknown) => {
      const used = useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks: [{ id: "st-pearl", name: "Pearl of Power", item: "kit/pearl", quantity: 1, holder: "Mage" }],
        stackId: "st-pearl",
        user: { name: "Mage", build, live },
        roll: () => 1,
      });
      assert.ok(used.ok, used.ok ? "" : used.reason);
      return used;
    };
    const used = outside(liveWith({ slots_1: 1, slots_2: 1, slots_3: 2, slots_4: 0, slots_5: 0 }));
    const now = slots(used.live);
    assert.equal(now.slots_3, 3, "the 3rd-level slot comes back");
    assert.equal(now.slots_2, 1, "only one");
    assert.equal(now.slots_1, 1);
    assert.equal(now.slots_4, 0, "never one above 3rd");
    const low = slots(outside(liveWith({ slots_1: 3, slots_2: 3, slots_3: 3, slots_4: 0 })).live);
    assert.equal(low.slots_1, 4, "the lower one when that is what is spent");
    const none = slots(outside(liveWith({ slots_4: 0, slots_5: 0 })).live);
    assert.equal(none.slots_4, 0, "nothing low enough spent, nothing back");
  }

  // ── In a fight, as its user's action ──
  {
    const pearl = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build,
          live: liveWith({ hp: 50, slots_1: 4, slots_2: 0, slots_3: 3, slots_4: 0 }),
          items: [{ item: pearl, quantity: 1, worn: false, name: "Pearl of Power" }],
        },
        {
          id: "goblin",
          name: "Goblin",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "goblin"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label.includes("Regain"));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "mage")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["mage"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    const now = slots(rulesetCombatant(step.state, "mage")!.sheet!.live);
    assert.equal(now.slots_2, 1, "the 2nd-level slot comes back");
    assert.equal(now.slots_4, 0);
  }

  // ── Refused ──
  refused(
    document((use) => delete use.recovers.count),
    /recovers: An item's use says how many spent pools it gives back, as count/,
  );
  refused(
    document((use) => (use.targets = "ally")),
    /recovers: Giving back spent pools is a "buff" on its user, targets "self"/,
  );
  refused(
    document((use) => (use.recovers.group = "runes")),
    /recovers\.group: Unknown pool group "runes"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose uses give back spent pools by count (recovers.count) requires schemaVersion 2 and capabilityApi 1.656 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(655) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(656) as never, document()), gate);
  }

  console.log(
    "Pearl of Power: an item gives back its user's highest spent slot of 3rd level or lower; gated at 1.656.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
