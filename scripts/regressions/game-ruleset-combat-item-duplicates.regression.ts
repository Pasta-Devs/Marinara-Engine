/**
 * An item's use that casts other entries (Capability API 1.640): 5e's Ring of Three Wishes, "expend 1
 * of its 3 charges to cast the wish spell from it."
 *
 *   - Each spell from 1st to 8th level is on its wearer's menu, though they know none of them; cast,
 *     it spends a charge, not a slot, and does what the spell does with the ring's own numbers.
 *   - Its last charge spent, nothing more is offered.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-duplicates-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 640);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
      mechanics: {
        ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const blast = {
    kind: "attack",
    targets: "enemy",
    range: 120,
    autoHit: true,
    amount: { flat: 12 },
    damageType: "fire",
  };
  const document = (use: Record<string, unknown> = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        spell("blast", "Blast", 3, blast),
        spell("big-blast", "Big Blast", 8, { ...blast, amount: { flat: 40 } }),
        spell("spark", "Spark", 0, { ...blast, amount: { flat: 2 } }),
        spell("meteor", "Meteor", 9, { ...blast, amount: { flat: 80 } }),
      ],
    });
    doc.items = { categories: [{ id: "ring", label: "Ring" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "three-wishes",
          label: "Ring of Three Wishes",
          item: {
            category: "ring",
            stack: 1,
            charges: { max: 3 },
            use: {
              kind: "utility",
              budget: "action",
              label: "Wish",
              charges: 1,
              duplicates: { catalog: "spells", upTo: 8 },
              ...use,
            },
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
  const ring = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const start = (charges = 3): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
            fields: { level: 5, ac: 16, speed: 30, hp_max: 44 },
          }),
          items: [{ item: ring, quantity: 1, worn: false, name: "Ring of Three Wishes", charges }],
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: { health: 60, defense: 10, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
    });
    state.order = ["fighter", "ogre"];
    state.turn = 0;
    return state;
  };
  const wishes = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "fighter")
      .map((one) => one.label)
      .filter((label) => label.startsWith("Ring of Three Wishes"))
      .sort();

  // ── 1st to 8th, paid with a charge ──
  {
    const state = start();
    assert.deepEqual(wishes(state), ["Ring of Three Wishes: Wish: Big Blast", "Ring of Three Wishes: Wish: Blast"]);
    const option = rulesetCombatOptions(definition, state, "fighter").find(
      (one) => one.label === "Ring of Three Wishes: Wish: Blast",
    )!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "fighter", optionId: option.id, targetIds: ["ogre"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    assert.equal(rulesetCombatant(step.state, "ogre")!.health.value, 48, "does what the spell does");
    assert.equal(rulesetCombatant(step.state, "fighter")!.charges?.[0], 2, "a charge spent");
  }

  // ── No charges, no wishes ──
  assert.deepEqual(wishes(start(0)), []);

  // ── Refusals ──
  refused(document({ duplicates: { catalog: "prayers", upTo: 8 } }), /Unknown catalog "prayers"/);
  refused(document({ amount: { flat: 3 } }), /casts other entries/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item use that casts other entries (use.duplicates) requires schemaVersion 2 and capabilityApi 1.640 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(639) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(640) as never, document()), gate);
  }

  console.log(
    "Ring of Three Wishes: an item use casts every 1st- to 8th-level spell, paid with a charge; gated at 1.640.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
