/**
 * Casting other entries (Capability API 1.474).
 *
 *   - Wish: every other spell of its catalog from 1st to 8th level is on the menu as "Wish: <spell>",
 *     though the sheet holds none of them; cast, it is paid for with Wish's 9th-level slot and does
 *     what the spell does. Cantrips, 9th-level spells and Wish itself are not offered; `only` narrows.
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-duplicates-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 474);
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
  const wish = (duplicates: Record<string, unknown> = { catalog: "spells", upTo: 8 }) =>
    spell("wish", "Wish", 9, { kind: "utility", duplicates });
  const others = [
    spell("blast", "Blast", 3, blast),
    spell("big-blast", "Big Blast", 8, { ...blast, amount: { flat: 40 } }),
    spell("cantrip", "Spark", 0, { ...blast, amount: { flat: 2 } }),
    spell("meteor", "Meteor", 9, { ...blast, amount: { flat: 80 } }),
  ];
  const fiveE = (duplicates?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [wish(duplicates), ...others] });
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
  const fight = (definition: RulesetDefinition) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const known = entries.filter((entry) => entry.id === "wish");
    const fields: Record<string, number | string> = {
      level: 17,
      ac: 12,
      speed: 30,
      hp_max: 80,
      spellcasting_ability: "int",
    };
    for (let level = 1; level <= 9; level++) fields[`slots_max_${level}`] = 1;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
            fields,
            lists: { spells: known.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: { health: 60, defense: 10, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
    });
    state.order = ["wizard", "ogre"];
    state.turn = 0;
    return state;
  };
  const labels = (definition: RulesetDefinition) =>
    rulesetCombatOptions(definition, fight(definition), "wizard")
      .map((one) => one.label)
      .filter((label) => label.startsWith("Wish"))
      .sort();

  // ── Wish ──
  {
    const definition = parsed(fiveE());
    assert.deepEqual(labels(definition), ["Wish: Big Blast", "Wish: Blast"], "1st to 8th, not Wish itself");
    const state = fight(definition);
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Wish: Blast")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["ogre"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    assert.equal(
      of(step.events, "damage").reduce((total, one) => total + one.dealt, 0),
      12,
      "Blast's own damage",
    );
    const wizard = rulesetCombatant(step.state, "wizard")!;
    const slots = readRulesetLive(definition, wizard.sheet!.build, wizard.sheet!.live).pools;
    assert.equal(slots.find((pool) => pool.key === "slots_9")?.value, 0, "paid with Wish's slot");
    assert.equal(slots.find((pool) => pool.key === "slots_3")?.value, 1, "not Blast's");
    const narrowed = parsed(fiveE({ catalog: "spells", upTo: 8, only: ["blast"] }));
    assert.deepEqual(labels(narrowed), ["Wish: Blast"], "only narrows");
  }

  // ── Refusals ──
  refused(fiveE({ catalog: "nope", upTo: 8 }), /Unknown catalog "nope"/);
  refused(fiveE({ catalog: "spells", upTo: 0 }), /upTo/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries cast other entries of a catalog (duplicates) requires schemaVersion 2 and capabilityApi 1.474 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(473) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(474) as never, fiveE()), gate);
  }

  console.log(
    "Duplicates: Wish offers every spell from 1st to 8th as its own option, paid with Wish's slot, narrowed by only; gated at 1.474.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
