/**
 * More conditions kept from whoever a zone holds (Capability API 1.697): Magic Circle and Hallow
 * naming "possessed" as a ninth beside the eight a ruleset folds into "charmed, frightened".
 *
 *   - Nine to twelve in `cantGive` and `frees` are read; thirteen are refused.
 *   - The ninth is kept like the rest: the fiend cannot put it on whoever stands inside.
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
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-keeps-out-twelve-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 697);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const extra = ["possessed", "dazed", "cursed", "hexed"];
  const named = (count: number) =>
    ["blinded", "charmed", "deafened", "frightened", "grappled", "paralyzed", "poisoned", "stunned", ...extra].slice(
      0,
      count,
    );
  const fiveE = (count: number): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of [...extra, "doomed"]) doc.sheet.live.conditions.push({ id, label: id });
    const keepsOut = {
      is: { types: ["fiend"] },
      cantGive: count > 12 ? [...named(12), "doomed"] : named(count),
      frees: count > 12 ? [...named(12), "doomed"] : named(count),
    };
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "circle",
          label: "Circle",
          rows: [{ list: "spells", values: { name: "Circle", level: 1, prepared: true } }],
          mechanics: {
            kind: "utility",
            area: { shape: "burst", size: 5 },
            range: 60,
            zone: { rounds: 600, triggers: [], keepsOut },
          },
        },
      ],
    });
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };

  // ── Read up to 12, refused past it ──
  for (const count of [9, 12]) parsed(fiveE(count));
  {
    const result = parseRulesetDefinition(fiveE(13));
    assert.equal(result.ok, false, "13 should be refused");
  }

  // ── The ninth, possessed, kept like the rest ──
  {
    const definition = parsed(fiveE(9));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const possess = {
      id: "possess",
      name: "Possess",
      budget: "action",
      reach: 5,
      autoHit: true,
      applies: [{ condition: "possessed", duration: { rounds: 10 } }],
    };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "imp",
          name: "Imp",
          side: "enemy",
          block: {
            health: 40,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            type: "fiend",
            actions: [possess],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 12, height: 5, tiles: Array.from({ length: 5 }, () => Array(12).fill("plains")) },
        placements: { cleric: { x: 4, y: 2 }, imp: { x: 5, y: 2 } },
      },
    });
    state.order = ["cleric", "imp"];
    state.turn = 0;
    // Before the circle the imp's possession takes.
    {
      const s = structuredClone(state);
      s.turn = 1;
      const option = rulesetCombatOptions(definition, s, "imp").find((one) => one.label === "Possess");
      assert.ok(option, "no Possess");
      const step = applyRulesetCombatChoice(
        definition,
        s,
        { actorId: "imp", optionId: option.id, targetIds: ["cleric"] },
        () => 10,
      );
      assert.ok(rulesetCombatant(step.state, "cleric")!.tracked.some((one) => one.condition === "possessed"));
    }
    const circle = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Circle");
    assert.ok(circle, "no Circle");
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: circle.id, targetIds: [], at: { x: 3, y: 2 } } as never,
      () => 10,
    );
    assert.ok((rulesetCombatant(cast.state, "cleric")!.zones ?? []).length > 0, JSON.stringify(cast.events));
    const s = structuredClone(cast.state);
    s.turn = 1;
    rulesetCombatant(s, "imp")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, s, "imp").find((one) => one.label === "Possess");
    assert.ok(option, "no Possess");
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: "imp", optionId: option.id, targetIds: ["cleric"] },
      () => 10,
    );
    assert.equal(
      rulesetCombatant(step.state, "cleric")!.tracked.some((one) => one.condition === "possessed"),
      false,
      JSON.stringify(step.events),
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone keeping out more than 8 conditions (keepsOut.cantGive, keepsOut.frees) requires schemaVersion 2 and capabilityApi 1.697 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(696) as never, fiveE(9)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(697) as never, fiveE(9)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(696) as never, fiveE(8)), gate);
  }

  console.log("Zone keepsOut: up to 12 conditions kept and freed, the ninth held like the rest; gated at 1.697.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
