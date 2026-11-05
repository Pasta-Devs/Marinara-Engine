/**
 * Walking and steering (Capability API 1.464).
 *
 *   - Compulsion: a foe holding its condition is not walked until steered; its caster's Steer is
 *     offered only while somebody holds it from them; steered, the foe is walked toward the point
 *     as its turn starts.
 *   - Acting first (1.472): with `walks: "after"` the foe is not walked as its turn starts, and is
 *     walked as it ends its turn, with the movement it has left.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetPositionOf,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-steering-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 464);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const compel = spell("compel", "Compel", {
    kind: "debuff",
    targets: "enemy",
    range: 60,
    autoHit: true,
    applies: [{ condition: "compelled", duration: { rounds: 10 } }],
  });
  const steer = (steers = "compelled") =>
    spell("steer", "Steer", { kind: "utility", area: { shape: "burst", size: 5 }, range: 120, steers });
  const fiveE = (
    behavior: Record<string, unknown> = { moves: "toward", from: "steered", walks: true },
    steers?: string,
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "compelled", label: "Compelled" });
    doc.combat.conditions.push({ condition: "compelled", effects: [], behavior });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [compel, steer(steers)] });
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
  let definition = parsed(fiveE());
  const entries = [compel, steer()];
  const block: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  } as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
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
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "thug", name: "Thug", side: "enemy", block },
      { id: "ogre", name: "Ogre", side: "enemy", block },
    ],
    board: {
      grid: { width: 16, height: 12, tiles: Array.from({ length: 12 }, () => Array(16).fill("plains")) },
      placements: { mage: { x: 2, y: 8 }, thug: { x: 8, y: 8 }, ogre: { x: 14, y: 11 } },
    },
  });
  state.order = ["mage", "thug", "ogre"];
  state.turn = 0;
  const act = (s: RulesetEncounterState, label: string, choice: Record<string, unknown>) => {
    s.turn = s.order.indexOf("mage");
    rulesetCombatant(s, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, s, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const steerOffered = (s: RulesetEncounterState) => {
    const ready = structuredClone(s);
    ready.turn = ready.order.indexOf("mage");
    rulesetCombatant(ready, "mage")!.budgets.action = 1;
    return rulesetCombatOptions(definition, ready, "mage").some((one) => one.label === "Steer");
  };
  const at = (s: RulesetEncounterState, id: string) => rulesetPositionOf(rulesetCombatant(s, id)!);

  assert.equal(steerOffered(state), false, "nothing to steer yet");
  const compelled = act(state, "Compel", { targetIds: ["thug"] }).state;
  assert.equal(steerOffered(compelled), true);

  // ── Not steered yet: the thug is not walked ──
  {
    const next = structuredClone(compelled);
    const step = advanceRulesetTurn(definition, next, roll);
    assert.equal(step.state.order[step.state.turn], "thug");
    assert.deepEqual(at(step.state, "thug"), { x: 8, y: 8 });
  }

  // ── Steered north: walked toward the point as its turn starts ──
  {
    const steered = act(structuredClone(compelled), "Steer", { at: { x: 8, y: 1 } });
    assert.deepEqual(
      of(steered.events, "steered").map((one) => one.targetIds),
      [["thug"]],
    );
    const next = steered.state;
    next.turn = next.order.indexOf("mage");
    const step = advanceRulesetTurn(definition, next, roll);
    assert.equal(step.state.order[step.state.turn], "thug");
    const now = at(step.state, "thug")!;
    assert.ok(now.y < 8, `walked north: ${JSON.stringify(now)}`);
    assert.equal(now.y, 2, "six cells, as far as its speed goes");
  }

  // ── Acting first (1.472) ──
  {
    definition = parsed(fiveE({ moves: "toward", from: "steered", walks: "after" }));
    const fresh = structuredClone(state);
    const compelledAfter = act(fresh, "Compel", { targetIds: ["thug"] }).state;
    const steered = act(compelledAfter, "Steer", { at: { x: 8, y: 1 } }).state;
    steered.turn = steered.order.indexOf("mage");
    const started = advanceRulesetTurn(definition, steered, roll).state;
    assert.equal(started.order[started.turn], "thug");
    assert.deepEqual(at(started, "thug"), { x: 8, y: 8 }, "not walked as its turn starts");
    const ended = advanceRulesetTurn(definition, started, roll);
    assert.equal(at(ended.state, "thug")!.y, 2, "walked as it ends its turn");
    assert.equal(ended.state.order[ended.state.turn], "ogre", "and the turn goes on");
    definition = parsed(fiveE());
  }

  // ── Refusals ──
  refused(fiveE({ walks: true }), /"walks" walks its holder the way "moves" says/);
  refused(fiveE(undefined, "nope"), /Unknown condition "nope"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions walk their holder or are steered (behavior walks, from steered, steers) requires schemaVersion 2 and capabilityApi 1.464 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(463) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(464) as never, fiveE()), gate);
    const after =
      'A ruleset whose conditions walk their holder as they end their turn (behavior walks "after") requires schemaVersion 2 and capabilityApi 1.472 or newer';
    const late = fiveE({ moves: "toward", from: "steered", walks: "after" });
    assert.equal(getCapabilityPackageInstallIssue(manifest(471) as never, late), after);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(472) as never, late), after);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(471) as never, fiveE()), after);
  }

  console.log(
    "Steering: Compulsion's foe is walked only once steered, toward the point, as far as it can, or as it ends its turn after acting; gated at 1.464 and 1.472.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
