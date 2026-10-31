/**
 * Called creatures that come against their user unless it meets a requirement (Capability API
 * 1.611): a Horn of Valhalla, "If you blow the horn without meeting its requirement, the summoned
 * berserkers attack you".
 *
 *   - A user whose derived value is at least `atLeast`: the berserkers are on their side.
 *   - One whose value is under it: on the other side, turned on them from the start.
 *   - Refusal of an unknown derived value; the install gate.
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
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-calls-hostile-unless-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 611);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const berserker = {
    id: "berserker",
    label: "Berserker",
    creature: {
      health: 67,
      defense: 13,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_2",
      actions: [{ id: "axe", name: "Greataxe", budget: "action", toHit: 5, damage: { flat: 9 }, reach: 5 }],
    },
  };
  const unlessReq = { derived: "horn_ready", atLeast: 1 };
  const horn = (hostileUnless: Record<string, unknown> = unlessReq) => ({
    id: "horn",
    label: "Horn of Valhalla",
    rows: [{ list: "spells", values: { name: "Horn of Valhalla", level: 0, prepared: true } }],
    mechanics: {
      kind: "utility",
      targets: "self",
      budget: "action",
      calls: { creature: "creatures/berserker", count: { flat: 2 }, rounds: 600, hostileUnless },
    },
  });
  const document = (hostileUnless?: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(berserker));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [horn(hostileUnless)] });
    // The requirement, read as Strength's modifier here: met at 12 or more.
    doc.sheet.derived.push({ id: "horn_ready", label: "Horn ready", op: "sum", of: [{ abilityMod: "str" }] });
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
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const blow = (str: number) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 100, defense: 10, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
      board: {
        grid: { width: 12, height: 5, tiles: Array.from({ length: 5 }, () => Array(12).fill("plains")) },
        placements: { ada: { x: 3, y: 2 }, brute: { x: 9, y: 2 } },
      },
    });
    state.order = ["ada", "brute"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "ada").find((one) => one.label === "Horn of Valhalla");
    assert.ok(option, "no horn");
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: option.id, targetIds: [] },
      roll,
    );
    const ids = of(taken.events, "called")[0]?.ids ?? [];
    assert.equal(ids.length, 2, JSON.stringify(taken.events));
    return {
      sides: ids.map((id) => taken.state.combatants.find((one) => one.id === id)!.side),
      turned: of(taken.events, "turnedOn").length,
    };
  };

  // ── The requirement met: on her side ──
  assert.deepEqual(blow(12), { sides: ["party", "party"], turned: 0 });
  // ── Not met: against her ──
  assert.deepEqual(blow(10), { sides: ["enemy", "enemy"], turned: 1 });

  // ── Refusal ──
  refused(document({ derived: "nope", atLeast: 1 }), /Unknown derived value "nope"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose called creatures come against their user unless it meets a requirement (calls.hostileUnless) requires schemaVersion 2 and capabilityApi 1.611 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(610) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(611) as never, document()), gate);
  }

  console.log("Called creatures against their user unless a requirement is met; refusal; gated at 1.611.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
