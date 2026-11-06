/**
 * Called creatures that may ignore every order (Capability API 1.665): 5e's obsidian steed, "If you
 * have a good alignment, the figurine has a 10 percent chance each time you use it to ignore your
 * orders, including a command to revert to figurine form."
 *
 *   - On a d100 at or under the chance, while `when` holds on the caller's sheet, the steed comes
 *     under nobody's control and a dismissal does not send it away.
 *   - Over the chance, or with `when` not met, it is the caller's as any called creature is.
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
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-calls-disobey-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 665);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const steed = {
    id: "nightmare",
    label: "Nightmare",
    creature: {
      health: 68,
      defense: 13,
      initiativeModifier: 2,
      speed: 60,
      tier: "cr_3",
      actions: [{ id: "hooves", name: "Hooves", budget: "action", toHit: 6, damage: { flat: 13 }, reach: 5 }],
    },
  };
  // "Good" read here as Charisma 12 or more.
  const figurine = () => ({
    id: "figurine",
    label: "Obsidian Steed",
    rows: [{ list: "spells", values: { name: "Obsidian Steed", level: 0, prepared: true } }],
    mechanics: {
      kind: "utility",
      targets: "self",
      budget: "action",
      calls: {
        creature: "creatures/nightmare",
        count: { flat: 1 },
        rounds: 600,
        dismissible: true,
        disobeys: { chance: 10, when: { value: { abilityScore: "cha" }, atLeast: 12 } },
      },
    },
  });
  const document = () => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(steed));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [figurine()] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const use = (cha: number, face: number) => {
    const roll = (sides: number) => (sides === 100 ? face : Math.min(sides, 10));
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
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha },
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
    const option = rulesetCombatOptions(definition, state, "ada").find((one) => one.label === "Obsidian Steed");
    assert.ok(option, "no figurine");
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: option.id, targetIds: [] },
      roll,
    );
    const called = of(taken.events, "called")[0];
    assert.equal(called?.ids.length, 1, JSON.stringify(taken.events));
    const id = called!.ids[0]!;
    const one = rulesetCombatant(taken.state, id)!;
    // Its dismissal, on the next turn of Ada's.
    taken.state.turn = taken.state.order.indexOf("ada");
    const ada = rulesetCombatant(taken.state, "ada")!;
    for (const budget of Object.keys(ada.budgets)) ada.budgets[budget] = 1;
    const dismiss = rulesetCombatOptions(definition, taken.state, "ada").find((each) =>
      each.id.startsWith("dismiss-called:"),
    );
    assert.ok(dismiss, "dismissal offered");
    const after = applyRulesetCombatChoice(
      definition,
      taken.state,
      { actorId: "ada", optionId: dismiss.id, targetIds: [] },
      roll,
    );
    const stays = !rulesetCombatant(after.state, id)!.defeated;
    return { disobeys: !!called!.disobeys, wild: !!one.calledWild, stays };
  };

  // ── Good, and the d100 at or under 10: it ignores every order ──
  assert.deepEqual(use(14, 10), { disobeys: true, wild: true, stays: true });
  // ── Over the chance, or not good: the caller's to command and to send away ──
  assert.deepEqual(use(14, 11), { disobeys: false, wild: false, stays: false });
  assert.deepEqual(use(8, 1), { disobeys: false, wild: false, stays: false });

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call whose creatures may ignore every order (calls.disobeys) requires schemaVersion 2 and capabilityApi 1.665 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(664) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(665) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(664) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Calls disobey: the obsidian steed ignores every order on its 10 in 100 for a good caller, a dismissal too; gated at 1.665.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
