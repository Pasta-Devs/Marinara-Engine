/**
 * Called creatures leashed to their caller, and sent away on a budget of its own (Capability API
 * 1.610): 5e's treant's Animate Trees, "until the treant dies or is more than 120 feet from the
 * tree; or until the treant takes a bonus action to turn it back into an inanimate tree".
 *
 *   - The dismissal is on the bonus action, not the action's own budget.
 *   - The trees leave once the treant is farther than the leash; not while it is within it.
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
  type RulesetCatalogEntriesById,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-call-leash-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 610);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const animate: Record<string, unknown> = {
    creature: "creatures/tree",
    count: { flat: 2 },
    endsWithCaller: true,
    dismissible: { budget: "bonus" },
    leash: 30,
  };
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 10, reach: 5, damage: { flat: 3 } };
  const creature = (actions: unknown[]) => ({
    health: 100,
    defense: 16,
    initiativeModifier: 0,
    speed: 30,
    tier: "cr_5",
    actions,
  });
  const fiveE = (calls: Record<string, unknown> = animate): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(
        {
          id: "treant",
          label: "Treant",
          creature: creature([
            slam,
            { id: "animate", name: "Animate Trees", budget: "action", uses: { per: "day", count: 1 }, calls },
          ]),
        },
        { id: "tree", label: "Tree", creature: creature([slam]) },
      );
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
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const fight = (): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
          }),
          live: {},
        },
        { id: "treant", name: "Treant", side: "enemy", creature: { catalogId: "creatures", entryId: "treant" } },
      ],
      board: {
        grid: { width: 30, height: 10, tiles: Array.from({ length: 10 }, () => Array(30).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, treant: { x: 20, y: 4 } },
      },
    });
    for (const one of state.combatants) one.initiative = { ada: 5, treant: 20 }[one.id]!;
    state.order = ["treant", "ada"];
    state.turn = 0;
    return state;
  };
  const called = (state: RulesetEncounterState) =>
    state.combatants.filter((one) => one.calledBy === "treant" && !one.dismissed).map((one) => one.id);
  const animated = () => {
    const taken = applyRulesetCombatChoice(
      definition,
      fight(),
      { actorId: "treant", optionId: "animate", targetIds: [] },
      roll,
    );
    assert.equal(called(taken.state).length, 2, JSON.stringify(taken.events));
    return taken.state;
  };

  // ── Turned back on a bonus action ──
  {
    const state = animated();
    const treant = rulesetCombatant(state, "treant")!;
    assert.equal(treant.budgets.action, 0);
    const dismiss = rulesetCombatOptions(definition, state, "treant").find(
      (one) => one.id === "dismiss-called:animate",
    );
    assert.ok(dismiss?.dismiss, "offered with the action spent");
    const sent = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "treant", optionId: "dismiss-called:animate", targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(sent.events, "sentAway").map((one) => one.reason),
      ["dismissed"],
    );
    assert.deepEqual(called(sent.state), []);
    assert.equal(rulesetCombatant(sent.state, "treant")!.budgets.bonus, 0, "on its bonus action");
  }
  // ── Leashed: within 30 feet they stay, past it they go ──
  {
    const state = animated();
    const treant = rulesetCombatant(state, "treant")!;
    const trees = state.combatants.filter((one) => one.calledBy === "treant");
    trees.forEach((one, index) => Object.assign(one, { x: 10 + index, y: 8 }));
    Object.assign(treant, { x: 16, y: 8 });
    const stay = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "treant", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(called(stay.state).length, 2, "both within 30 feet");
    treant.x = 17;
    const gone = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "treant", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(gone.events, "sentAway").map((one) => one.reason),
      ["leash"],
    );
    assert.deepEqual(called(gone.state), [trees[1]!.id], "only the one past 30 feet");
  }

  // ── Refusals ──
  refused(fiveE({ ...animate, dismissible: { budget: "nope" } }), /Unknown budget "nope"/);
  refused(fiveE({ ...animate, leash: 0 }), /leash/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose called creatures leave once their caller is too far (calls.leash), or are sent away on a budget of its own (calls.dismissible.budget), requires schemaVersion 2 and capabilityApi 1.610 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(609) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(610) as never, fiveE()), gate);
    const leashOnly = fiveE({ ...animate, dismissible: true });
    assert.equal(getCapabilityPackageInstallIssue(manifest(609) as never, leashOnly), gate);
  }

  console.log("Called creatures leashed to their caller and sent away on a bonus action; refusals; gated at 1.610.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
