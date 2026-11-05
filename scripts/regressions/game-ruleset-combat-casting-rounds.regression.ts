/**
 * Casting over rounds (Capability API 1.461).
 *
 *   - A three-round cast: paid and begun, concentrated on; its user's action spent on it as their
 *     next turn starts; landing as the last is spent, and nothing lands before.
 *   - Its user unable to act as a turn starts: it fails, and the slot it cost is given back.
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
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-casting-rounds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 461);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const dread = (castingRounds: unknown = 3) =>
    ({
      id: "dread",
      label: "Dread",
      rows: [{ list: "spells", values: { name: "Dread", level: 1, prepared: true } }],
      mechanics: {
        kind: "debuff",
        targets: "enemy",
        range: 60,
        autoHit: true,
        cost: [{ pool: "slots_1", amount: 1 }],
        castingRounds,
        applies: [{ condition: "frightened", duration: { rounds: 10 } }],
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (castingRounds?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [dread(castingRounds)] });
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
  const block: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const start = createRulesetEncounter({
    definition,
    seed: 1,
    roller: (sides) => (sides === 20 ? 15 : 3),
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
  });
  start.order = ["mage", "thug", "ogre"];
  start.turn = 0;
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, (sides) => (sides === 20 ? 15 : 3));
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const endTurn = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });
  /** Round to the mage's next turn: everybody ends theirs. */
  const round = (state: RulesetEncounterState) => {
    const events: RulesetCombatEvent[] = [];
    let now = state;
    for (const id of ["mage", "thug", "ogre"]) {
      const step = endTurn(now, id);
      events.push(...step.events);
      now = step.state;
    }
    assert.equal(now.order[now.turn], "mage");
    return { state: now, events };
  };
  const slots = (state: RulesetEncounterState) => {
    const mage = rulesetCombatant(state, "mage")!;
    return readRulesetLive(definition, mage.sheet!.build, mage.sheet!.live).pools.find(
      (pool) => pool.key === "slots_1",
    )!.value;
  };
  const frightened = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "thug")!.tracked.some((one) => one.condition === "frightened");
  const castings = (events: RulesetCombatEvent[]) => of(events, "casting").map((one) => [one.outcome, one.left]);

  const before = slots(start);
  const option = rulesetCombatOptions(definition, start, "mage").find((one) => one.label === "Dread");
  assert.ok(option, "no Dread");
  const begun = act(start, { actorId: "mage", optionId: option.id, targetIds: ["thug"] });
  assert.deepEqual(castings(begun.events), [["started", 2]]);
  assert.equal(slots(begun.state), before - 1, "paid as it is begun");
  assert.equal(frightened(begun.state), false, "nothing lands yet");
  assert.equal(rulesetCombatant(begun.state, "mage")!.concentrating?.label, "Dread", "concentrating on the casting");

  // ── Carried on, then landing ──
  {
    const second = round(structuredClone(begun.state));
    assert.deepEqual(castings(second.events), [["continued", 1]]);
    assert.equal(rulesetCombatant(second.state, "mage")!.budgets.action, 0, "its action spent on the casting");
    assert.equal(frightened(second.state), false);
    const third = round(second.state);
    assert.deepEqual(castings(third.events), [["completed", undefined]]);
    assert.equal(frightened(third.state), true, "it lands as the last round is spent");
    assert.equal(rulesetCombatant(third.state, "mage")!.casting, undefined);
    assert.equal(slots(third.state), before - 1, "paid once");
  }

  // ── Unable to act as a turn starts: lost, and the slot given back ──
  {
    const state = structuredClone(begun.state);
    rulesetCombatant(state, "mage")!.tracked.push({ condition: "incapacitated", rounds: null } as never);
    const lost = round(state);
    assert.ok(
      castings(lost.events).some(([outcome]) => outcome === "lost"),
      JSON.stringify(castings(lost.events)),
    );
    assert.equal(rulesetCombatant(lost.state, "mage")!.casting, undefined);
    assert.equal(slots(lost.state), before, "the slot is given back");
    assert.equal(frightened(lost.state), false);
  }

  // ── Refusals ──
  refused(fiveE(1), /castingRounds/);
  refused(fiveE(11), /castingRounds/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries take rounds to cast (castingRounds) requires schemaVersion 2 and capabilityApi 1.461 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(460) as never, fiveE(3)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(461) as never, fiveE(3)), gate);
  }

  console.log(
    "Casting rounds: begun and paid, its action spent each turn, landing on the last; lost with the slot given back when its caster cannot act; gated at 1.461.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
