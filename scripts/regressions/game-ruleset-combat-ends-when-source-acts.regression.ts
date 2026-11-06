/**
 * A condition that ends once its source takes another action (Capability API 1.599): 5e's Arcane
 * Hand's Interposing Hand, "until you give the hand a different command".
 *
 *   - `endsWhenSource.acts`: on until its source acts again; a move or a turn ended leaves it on.
 *   - The same action again puts it on afresh; another of theirs takes it off.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-when-source-acts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 599);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { targets: "enemy", range: 60, budget: "action", ...mechanics },
  });
  const spells = [
    spell("interpose", "Interpose", {
      kind: "debuff",
      autoHit: true,
      applies: [{ condition: "interposed", duration: { rounds: 10 } }],
    }),
    spell("spark", "Spark", { kind: "attack", autoHit: true, amount: { flat: 1 }, damageType: "fire" }),
  ];
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    doc.sheet.live.conditions.push({ id: "interposed", label: "Interposed" });
    doc.combat.conditions.push({ condition: "interposed", effects: [], endsWhenSource: { acts: true } });
    return doc;
  };
  const parsed = parseRulesetDefinition(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (): RulesetStatBlock =>
    ({ health: 40, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const roll = () => 10;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    combatants: [
      {
        id: "mage",
        name: "Mage",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int" },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      { id: "wolf", name: "Wolf", side: "enemy", block: block() },
      { id: "bear", name: "Bear", side: "enemy", block: block() },
    ],
  });
  state.order = ["mage", "wolf", "bear"];
  state.turn = 0;
  const held = (s: RulesetEncounterState, id: string) =>
    rulesetCombatant(s, id)!.tracked.some((one) => one.condition === "interposed");
  const cast = (s: RulesetEncounterState, label: string, target: string): RulesetEncounterState => {
    s.turn = 0;
    rulesetCombatant(s, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, s, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: "mage", optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.ok(!step.events.some((one) => one.type === "refused"), JSON.stringify(step.events));
    return step.state;
  };

  // ── Put on, it holds while its source does nothing else ──
  const once = cast(state, "Interpose", "wolf");
  assert.ok(held(once, "wolf"));
  // ── The same command again: on the bear now, off the wolf ──
  const moved = cast(structuredClone(once), "Interpose", "bear");
  assert.ok(held(moved, "bear"));
  assert.ok(!held(moved, "wolf"), "the earlier command is over");
  // ── Another action: off ──
  const sparked = cast(structuredClone(once), "Spark", "bear");
  assert.ok(!held(sparked, "wolf"), "a different command ends it");
  // ── Ending the turn leaves it on ──
  {
    const s = structuredClone(once);
    s.turn = 0;
    const end = rulesetCombatOptions(definition, s, "mage").find((one) => one.kind === "end");
    if (end) {
      const step = applyRulesetCombatChoice(definition, s, { actorId: "mage", optionId: end.id, targetIds: [] }, roll);
      assert.ok(held(step.state, "wolf"), "ending the turn is no command");
    }
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that ends when its source is stopped or unheard (endsWhenSource) requires schemaVersion 2 and capabilityApi 1.584 or newer";
    const acts =
      "A ruleset with a condition that ends once its source takes another action (endsWhenSource.acts) requires schemaVersion 2 and capabilityApi 1.599 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(598) as never, document()), acts);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(599) as never, document()), acts);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(599) as never, document()), gate);
  }

  console.log(
    "Ends when its source acts: on until another action of theirs, put on afresh by the same; gated at 1.599.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
