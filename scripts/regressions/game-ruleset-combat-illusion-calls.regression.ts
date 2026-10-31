/**
 * Called images rather than creatures (Capability API 1.568): 5e's Mislead and Project Image.
 *
 *   - `calls.illusion`: what is aimed at the image passes through it, doing nothing, and shows it for
 *     what it is to the attacker's side, who may not aim at it again; the other side still may.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-illusion-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 568);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const double = {
    id: "illusory-double",
    label: "Illusory Double",
    creature: {
      health: 1,
      defense: 10,
      initiativeModifier: 0,
      speed: 60,
      tier: "cr_0",
      actions: [{ id: "feint", name: "Feint", budget: "action", toHit: 0, damage: { flat: 0 } }],
    },
  };
  const document = (illusion = true) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(double));
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "mislead",
          label: "Mislead",
          rows: [{ list: "spells", values: { name: "Mislead", level: 5, prepared: true } }],
          mechanics: {
            kind: "utility",
            targets: "self",
            budget: "action",
            calls: {
              creature: "creatures/illusory-double",
              count: { flat: 1 },
              initiative: "after",
              commandedWith: "bonus",
              ...(illusion ? { illusion: true } : {}),
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
  const roll = () => 15;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const brute = (id: string) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 100,
      defense: 10,
      initiativeModifier: -5,
      speed: 30,
      actions: [{ name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 6, flat: 3 } }],
    } as never,
  });
  let state: RulesetEncounterState = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    bestiary,
    combatants: [
      {
        id: "wizard",
        name: "Wizard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 40 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      brute("brute"),
    ],
  });
  state.order = ["wizard", "brute"];
  state.turn = 0;
  const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Mislead")!;
  state = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "wizard", optionId: option.id, targetIds: [] },
    roll,
  ).state;
  const doubleId = state.combatants.find((one) => one.calledBy === "wizard")!.id;
  assert.deepEqual(rulesetCombatant(state, doubleId)!.illusion, { seenBy: [] });

  // ── The brute's club passes through the double, and the brute's side sees it for an image ──
  state.turn = state.order.indexOf("brute");
  const club = () => rulesetCombatOptions(definition, state, "brute").find((one) => one.label === "Club")!;
  const aimable = () => rulesetOptionTargets(definition, state, "brute", club());
  assert.ok(aimable().includes(doubleId), "aimed at before it is seen through");
  const swung = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "brute", optionId: club().id, targetIds: [doubleId] },
    roll,
  );
  assert.deepEqual(of(swung.events, "refused"), []);
  assert.deepEqual(
    of(swung.events, "seenThrough").map((one) => one.targetId),
    [doubleId],
  );
  assert.equal(of(swung.events, "attack").length, 0, "nothing rolled against an image");
  assert.equal(rulesetCombatant(swung.state, doubleId)!.health!.value, 1);
  state = swung.state;
  // Its budget spent; a fresh one to ask whom it could aim at now.
  rulesetCombatant(state, "brute")!.budgets.action = 1;
  assert.ok(!aimable().includes(doubleId), "seen through, never aimed at again");
  assert.ok(aimable().includes("wizard"));

  // ── Without illusion it is a creature like any other ──
  {
    const plain = parsed(document(false));
    assert.equal(
      plain.catalogs!.find((catalog) => catalog.id === "spells")!.entries![0]!.mechanics!.calls!.illusion,
      undefined,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call that makes images rather than creatures (calls.illusion) requires schemaVersion 2 and capabilityApi 1.568 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(567) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(568) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(567) as never, document(false)), gate);
  }

  console.log(
    "Illusion calls: a club passes through Mislead's double, which its side then sees for an image and aims at no more; gated at 1.568.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
