/**
 * What a target wears (Capability API 1.711): 5e's "a creature wearing armor made of metal".
 *
 *   - targetIs `wears: {tags}`: only one wearing an item of those tags passes, worn on its sheet; one
 *     carried and not worn does not.
 *   - A creature's own `wears` tags, read off its catalog entry into its block.
 *   - Beside types, both must hold; inside `except`, it excepts.
 *   - A spell's clause dealt only to one in metal: Shocking Grasp's way.
 *   - Import refusals and the install gate.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wears-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 711);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const grasp: RulesetCatalogEntry = {
    id: "grasp",
    label: "Shocking Grasp",
    rows: [{ list: "spells", values: { name: "Shocking Grasp", level: 0, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      targets: "any",
      range: 60,
      budget: "action",
      amount: { flat: 1 },
      damageType: "lightning",
      plus: [{ flat: 7, type: "lightning", targetIs: { wears: { tags: ["metal"] } } }],
    },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(grasp)] });
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.wears = ["armor", "metal"];
    edit(doc);
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
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const knight = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual(knight.wears, ["armor", "metal"]);
  const entries = definition.catalogs!.find((one) => one.id === "spells")!.entries! as RulesetCatalogEntry[];
  const armor = (name: string, tags: string[], worn = true) =>
    ({
      name,
      quantity: 1,
      worn,
      item: { category: "armor", tags, effects: [] } as unknown as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const person = (id: string, items: RulesetSheetItem[]) => ({
    id,
    name: id,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int" },
      lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
    }),
    live: {},
    catalogs: { spells: entries },
    items,
  });
  const bandit = {
    health: 60,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        person("mage", []),
        person("paladin", [armor("Chain Mail", ["metal", "heavy"])]),
        person("packer", [armor("Chain Mail", ["metal", "heavy"], false)]),
        person("ranger", [armor("Leather", ["light"])]),
        { id: "knight", name: "Knight", side: "enemy" as const, block: { ...knight, health: 60 } },
        { id: "bandit", name: "Bandit", side: "enemy" as const, block: bandit },
      ],
    });
    state.order = ["mage", "paladin", "packer", "ranger", "knight", "bandit"];
    state.turn = 0;
    return state;
  };

  // ── Who passes `wears` ──
  {
    const state = fight();
    const metal = { wears: { tags: ["metal"] } };
    const passes = (test: Parameters<typeof rulesetTargetIs>[2]) =>
      state.combatants.filter((one) => rulesetTargetIs(definition, one, test)).map((one) => one.id);
    assert.deepEqual(passes(metal), ["paladin", "knight"]);
    assert.deepEqual(passes({ wears: { tags: ["light", "heavy"] } }), ["paladin", "ranger"]);
    // Beside a type, both must hold; excepted, it excepts.
    const type = creature.type;
    if (type) assert.deepEqual(passes({ types: [type], ...metal }), ["knight"]);
    assert.deepEqual(passes({ except: metal }), ["mage", "packer", "ranger", "bandit"]);
  }

  // ── Shocking Grasp's clause lands only on one in metal ──
  {
    const dealt = (target: string) => {
      const state = fight();
      const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Shocking Grasp")!;
      assert.ok(option);
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: option.id, targetIds: [target] },
        () => 10,
      );
      assert.deepEqual(of(step.events, "refused"), []);
      return of(step.events, "damage").reduce((sum, one) => sum + one.dealt, 0);
    };
    assert.equal(dealt("knight"), 8);
    assert.equal(dealt("bandit"), 1);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.catalogs.at(-1).entries[0].mechanics.plus[0].targetIs = { wears: { tags: [] } })),
    /tags/,
  );
  refused(
    fiveE((doc) => (doc.catalogs.at(-1).entries[0].mechanics.plus[0].targetIs = { wears: { metal: true } })),
    /metal|Unrecognized/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset that tests what a target wears, or gives a creature worn tags (wears), requires schemaVersion 2 and capabilityApi 1.711 or newer";
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
    const bare = JSON.parse(fiveEText);
    assert.equal(getCapabilityPackageInstallIssue(manifest(710) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(710) as never,
        fiveE((doc) => delete doc.catalogs.at(-1).entries[0].mechanics.plus),
      ),
      gate,
      "a creature's wears alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(711) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(710) as never, bare), gate);
  }

  console.log(
    "Wears: the paladin in worn chain mail and a knight in metal pass, chain mail carried does not; Shocking Grasp deals 8 to the knight and 1 to a bandit; gated at 1.711.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
